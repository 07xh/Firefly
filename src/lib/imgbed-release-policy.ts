/**
 * Feature rollout is explicit, server-side and fail-closed.
 * Enabling library browsing does not enable uploads or destructive deletion.
 */
export type ImgBedReleaseFlags = {
	FIREFLY_IMGBED_ENABLED?: string;
	FIREFLY_IMGBED_UPLOAD_ENABLED?: string;
	FIREFLY_IMGBED_DELETE_ENABLED?: string;
};

export type ImgBedMethod = "GET" | "POST" | "DELETE";

export function imgBedReleaseDenial(
	flags: ImgBedReleaseFlags,
	method: ImgBedMethod,
): string | null {
	if (flags.FIREFLY_IMGBED_ENABLED !== "true") {
		return "实验图片库尚未启用，原有 GitHub 图片上传不受影响。";
	}
	if (method === "POST" && flags.FIREFLY_IMGBED_UPLOAD_ENABLED !== "true") {
		return "实验图片库已开启浏览，但上传功能尚未通过验收。";
	}
	if (method === "DELETE" && flags.FIREFLY_IMGBED_DELETE_ENABLED !== "true") {
		return "图片删除尚未通过验收，已保护性禁止操作。";
	}
	return null;
}
