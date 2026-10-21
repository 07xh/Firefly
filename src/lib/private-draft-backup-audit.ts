import {
	getPrivateR2Backup,
	listPrivateR2Backups,
	type PrivateDraftBackupBucket,
	type PrivateDraftBackupRecord,
} from "./private-draft-r2-backup";
import {
	getPrivateDraft,
	getPrivateDraftRevision,
	listPrivateDraftRevisions,
	PrivateDraftError,
	type PrivateDraftKV,
} from "./private-drafts";

const MAX_VERSIONS = 12;
const VALID_SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u;

type AuditIssueCode =
	| "missing_r2"
	| "r2_corrupt"
	| "kv_history_corrupt"
	| "version_mismatch"
	| "current_changed";

type AuditIssue = {
	version: string;
	code: AuditIssueCode;
};

type AuditRecord = PrivateDraftBackupRecord;

function sameRecord(a: AuditRecord, b: AuditRecord): boolean {
	return (
		a.schema === b.schema &&
		a.slug === b.slug &&
		a.version === b.version &&
		a.extension === b.extension &&
		a.updatedAt === b.updatedAt &&
		a.content === b.content
	);
}

async function currentRecord(store: PrivateDraftKV, slug: string) {
	try {
		return await getPrivateDraft(store, slug);
	} catch (error) {
		if (error instanceof PrivateDraftError && error.status === 404) return null;
		throw error;
	}
}

/**
 * This is a bounded read-only snapshot audit, NOT an assertion of
 * transactional/continuous durability. Never repair data in an audit.
 * Fail closed as "incomplete" rather than silently skipping large histories.
 */
export async function auditPrivateDraftBackups(
	store: PrivateDraftKV,
	bucket: PrivateDraftBackupBucket,
	slug: string,
) {
	if (!VALID_SLUG.test(slug)) {
		throw new PrivateDraftError("草稿文件名不合法，无法核对备份。", 400);
	}
	const before = await currentRecord(store, slug);
	const [history, remote] = await Promise.all([
		listPrivateDraftRevisions(store, slug),
		listPrivateR2Backups(bucket, slug),
	]);
	const allVersions = new Set([
		...(before ? [before.version] : []),
		...history.items.map((item) => item.version),
		...remote.items.map((item) => item.version),
	]);
	const base = {
		slug,
		checkedAt: new Date().toISOString(),
		currentPresent: Boolean(before),
		versionsFound: allVersions.size,
		maxVersionsPerAudit: MAX_VERSIONS,
	};
	if (!before && history.items.length === 0 && remote.items.length === 0) {
		throw new PrivateDraftError("没有找到此私人草稿或历史备份。", 404);
	}
	if (
		history.cursor !== null ||
		remote.cursor !== null ||
		allVersions.size > MAX_VERSIONS
	) {
		return {
			...base,
			status: "incomplete" as const,
			versionsChecked: 0,
			recoverableR2OnlyVersions: 0,
			issues: [] as AuditIssue[],
			notice: "历史版本超过单次核验上限或存在后续分页；不能据此认定备份完整。",
		};
	}
	const issues: AuditIssue[] = [];
	const known = new Map<string, AuditRecord>();
	if (before) known.set(before.version, before);
	for (const item of history.items) {
		try {
			const archived = await getPrivateDraftRevision(store, slug, item.version);
			const existing = known.get(item.version);
			if (existing && !sameRecord(existing, archived)) {
				issues.push({ version: item.version, code: "version_mismatch" });
			} else {
				known.set(item.version, archived);
			}
		} catch {
			issues.push({ version: item.version, code: "kv_history_corrupt" });
		}
	}
	let r2Only = 0;
	for (const version of allVersions) {
		let remoteRecord: AuditRecord;
		try {
			remoteRecord = await getPrivateR2Backup(bucket, slug, version);
		} catch (error) {
			issues.push({
				version,
				code:
					error instanceof Error && "status" in error && error.status === 404
						? "missing_r2"
						: "r2_corrupt",
			});
			continue;
		}
		const local = known.get(version);
		if (!local) {
			if (
				!history.items.some((item) => item.version === version) &&
				before?.version !== version
			) {
				r2Only++;
			}
		} else if (!sameRecord(local, remoteRecord)) {
			issues.push({ version, code: "version_mismatch" });
		}
	}
	const after = await currentRecord(store, slug);
	if (
		(before === null) !== (after === null) ||
		(before !== null && after !== null && !sameRecord(before, after))
	) {
		issues.push({
			version: after?.version ?? before?.version ?? "",
			code: "current_changed",
		});
		return {
			...base,
			status: "incomplete" as const,
			versionsChecked: allVersions.size,
			recoverableR2OnlyVersions: r2Only,
			issues,
			notice: "核验期间当前稿发生变化；结果可能过时，需重新核验。",
		};
	}
	return {
		...base,
		status: issues.length ? ("attention" as const) : ("verified" as const),
		versionsChecked: allVersions.size,
		recoverableR2OnlyVersions: r2Only,
		issues,
		notice:
			"仅完成当前时刻的有限只读核验，不能证明 KV/R2 跨服务事务或异地灾难备份。",
	};
}
