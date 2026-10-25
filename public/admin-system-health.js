// Firefly admin-only system status. Read-only by design.
(() => {
	const $ = (id) => document.getElementById(id);
	const status = $("adminSystemHealthStatus");
	const report = $("adminSystemHealthReport");
	const button = $("adminSystemHealthProbe");
	if (!status || !report || !button) return;

	let busy = false;
	let loaded = false;

	function line(label, value) {
		const row = document.createElement("div");
		row.className = "admin-system-health-row";
		const heading = document.createElement("strong");
		heading.textContent = label;
		const detail = document.createElement("span");
		detail.textContent = value;
		row.append(heading, detail);
		return row;
	}

	function bool(flag) {
		return flag === true ? "已配置" : "未配置";
	}

	function display(data) {
		report.replaceChildren(
			line("后台密码", bool(data.authentication?.passwordConfigured)),
			line("会话 KV", bool(data.authentication?.sessionKvBound)),
			line("GitHub 文章令牌", bool(data.github?.tokenConfigured)),
			line("GitHub 只读连通性",
				data.connectivity?.github === "ok" ? "正常"
					: data.connectivity?.github === "failed" ? "检测失败"
					: data.connectivity?.github === "not_configured" ? "未配置"
					: "尚未检测"),
			line("私人草稿 KV（可选）", bool(data.optional?.privateDraftKvBound)),
			line("私人草稿 D1（可选）", bool(data.optional?.privateDraftD1Bound)),
			line("私人草稿 R2 备份（可选）", bool(data.optional?.privateDraftR2Bound)),
			line("独立图床令牌（可选）", bool(data.optional?.externalImageHostTokenConfigured)),
		);
		const issues = Array.isArray(data.issues) ? data.issues.filter((item) => typeof item === "string") : [];
		status.textContent = issues.length ? issues.join("；") : "后台基本配置已具备。";
		if (data.connectivity?.github === "failed") {
			status.textContent += " GitHub 连接检测失败，请检查令牌、仓库权限或网络。";
		}
		if (typeof data.note === "string") {
			const note = document.createElement("p");
			note.textContent = data.note;
			note.className = "muted";
			report.append(note);
		}
	}

	async function load(probe) {
		if (busy) return;
		busy = true;
		button.disabled = true;
		status.textContent = probe ? "正在进行只读连接检查…" : "正在读取后台配置状态…";
		try {
			const path = "/api/admin/system-health/" + (probe ? "?probe=1" : "");
			const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
			if (response.status === 401) {
				location.assign("/admin/login/?next=%2Fadmin%2F");
				return;
			}
			const data = await response.json().catch(() => ({ error: "运行状态响应无法解析。" }));
			if (!response.ok || data.readOnly !== true || !data.authentication || !data.github) {
				throw new Error(data.error || "运行状态响应不完整。");
			}
			display(data);
			loaded = true;
		} catch (error) {
			report.replaceChildren();
			status.textContent = error instanceof Error ? error.message : "运行状态读取失败。";
		} finally {
			busy = false;
			button.disabled = false;
		}
	}

	button.addEventListener("click", () => load(true));
	$("tabSystem")?.addEventListener("click", () => { if (!loaded) load(false); });
	if (!$("systemTabPanel")?.hidden) load(false);
})();
