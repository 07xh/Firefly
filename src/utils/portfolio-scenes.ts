import { featuredProjectIds } from "@/config/portfolioConfig";
import { getSortedProjects } from "@/utils/content-utils";
import { removeFileExtension } from "@/utils/url-utils";

/** The same ordered project scenes power the home, project landing and detail routes. */
export async function getPortfolioScenes() {
	const projects = (await getSortedProjects()).filter(
		({ id, data }) =>
			data.repository &&
			!["example-project", "firefly"].includes(removeFileExtension(id)),
	);
	const ordered = [
		...featuredProjectIds.flatMap((id) =>
			projects.filter((project) => removeFileExtension(project.id) === id),
		),
		...projects.filter(
			(project) => !featuredProjectIds.includes(removeFileExtension(project.id)),
		),
	];
	return ordered.map((entry, index) => ({
		entry,
		slug: removeFileExtension(entry.id),
		position: index + 1,
		total: ordered.length,
		previous: ordered.length > 1
			? {
				slug: removeFileExtension(ordered[(index - 1 + ordered.length) % ordered.length].id),
				title: ordered[(index - 1 + ordered.length) % ordered.length].data.title,
			}
			: null,
		next: ordered.length > 1
			? {
				slug: removeFileExtension(ordered[(index + 1) % ordered.length].id),
				title: ordered[(index + 1) % ordered.length].data.title,
			}
			: null,
	}));
}
