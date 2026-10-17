import type { APIRoute } from "astro";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const POST: APIRoute = async ({ request }) => {
	try {
		const input = (await request.json()) as { markdown?: unknown };
		if (typeof input.markdown !== "string") {
			return new Response(JSON.stringify({ error: "缺少 Markdown 正文" }), {
				status: 400,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}
		if (input.markdown.length > 500_000) {
			return new Response(JSON.stringify({ error: "正文超过 500 KB，无法预览" }), {
				status: 413,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}

		// Existing articles are loaded as complete source files, including frontmatter.
		const source = input.markdown
			.replace(/^---\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "")
			.trim();
		const rendered = source
			? await marked.parse(source, { gfm: true })
			: "<p>暂无内容</p>";
		const html = sanitizeHtml(rendered, {
			allowedTags: [
				...sanitizeHtml.defaults.allowedTags,
				"img",
				"h1",
				"h2",
				"h3",
				"h4",
				"h5",
				"h6",
				"table",
				"thead",
				"tbody",
				"tr",
				"th",
				"td",
				"del",
			],
			allowedAttributes: {
				a: ["href", "name", "target", "rel"],
				img: ["src", "alt", "title", "width", "height"],
				code: ["class"],
				pre: ["class"],
				th: ["align"],
				td: ["align"],
			},
			allowedSchemes: ["http", "https", "mailto"],
			transformTags: {
				a: sanitizeHtml.simpleTransform("a", {
					rel: "noopener noreferrer",
					target: "_blank",
				}),
			},
		});
		return new Response(JSON.stringify({ html }), {
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "private, no-store",
			},
		});
	} catch {
		return new Response(JSON.stringify({ error: "生成 Markdown 预览失败" }), {
			status: 400,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}
};
