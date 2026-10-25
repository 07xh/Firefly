/**
 * Parse only the YAML frontmatter header of a public article for the admin list.
 * Preserves the original Markdown/MDX source and does not interpret body examples
 * as metadata. Handles inline and indented YAML tag lists without YAML execution.
 */
function frontmatterLines(source: string): string[] {
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
	if (!match) throw new Error("文章缺少有效的 Frontmatter，无法可靠读取元数据");
	return match[1].split(/\r?\n/);
}

function decodeScalar(value: string): string {
	const raw = value.trim();
	if (raw.startsWith('"') && raw.endsWith('"')) {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed === "string") return parsed;
		} catch {
			return raw.slice(1, -1);
		}
	}
	if (raw.startsWith("'") && raw.endsWith("'")) {
		return raw.slice(1, -1).replace(/''/g, "'");
	}
	return raw;
}

function splitInlineList(value: string): string[] {
	const raw = value.trim();
	if (!raw.startsWith("[") || !raw.endsWith("]")) return [];
	const content = raw.slice(1, -1);
	const parts: string[] = [];
	let current = "";
	let quote = "";
	let escaped = false;
	for (const char of content) {
		if (escaped) {
			current += char;
			escaped = false;
		} else if (char === "\\" && quote === '"') {
			current += char;
			escaped = true;
		} else if (quote && char === quote) {
			current += char;
			quote = "";
		} else if (!quote && (char === '"' || char === "'")) {
			current += char;
			quote = char;
		} else if (!quote && char === ",") {
			parts.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	if (quote) throw new Error("文章标签列表存在未闭合的引号");
	if (current.trim()) parts.push(current);
	return parts;
}

export type AdminArticleMetadata = {
	title: string;
	published: string;
	date: string;
	category: string;
	tags: string[];
	draft: boolean;
};

export function readAdminArticleMetadata(source: string, fallbackTitle: string): AdminArticleMetadata {
	const lines = frontmatterLines(source);
	const values = new Map<string, string>();
	let tags: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = /^([A-Za-z][A-Za-z0-9_]*):(?:\s+(.*)|\s*)$/.exec(lines[i]);
		if (!match) continue;
		const key = match[1];
		if (!["title", "published", "date", "category", "draft", "tags"].includes(key)) continue;
		const raw = (match[2] ?? "").trim();
		if (key !== "tags") {
			values.set(key, decodeScalar(raw));
			continue;
		}
		if (raw.startsWith("[")) {
			tags = splitInlineList(raw);
		} else if (raw) {
			tags = [raw];
		} else {
			tags = [];
			for (let j = i + 1; j < lines.length; j++) {
				const next = lines[j];
				if (!next.trim()) continue;
				const item = /^[ \t]+-[ \t]+(.+)$/.exec(next);
				if (!item) break;
				tags.push(item[1]);
			}
		}
	}
	return {
		title: (values.get("title") || fallbackTitle).trim(),
		published: values.get("published") || "",
		date: values.get("date") || "",
		category: values.get("category") || "",
		tags: [...new Set(tags.map(decodeScalar).map(tag => tag.trim()).filter(Boolean))],
		draft: values.get("draft") === "true",
	};
}
