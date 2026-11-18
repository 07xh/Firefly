// Lightweight progressive enhancement: the site works with JavaScript disabled.
const root = document.querySelector<HTMLElement>(".portfolio");

if (root) {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
	let ticking = false;

	const updateScroll = () => {
		ticking = false;
		const scrollable = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight,
		);
		const progress = scrollable
			? Math.min(1, Math.max(0, window.scrollY / scrollable))
			: 0;
		root.style.setProperty("--space-scroll-progress", String(progress));
		root.toggleAttribute("data-scrolled", window.scrollY > 16);
	};

	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		window.requestAnimationFrame(updateScroll);
	};
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll, { passive: true });
	updateScroll();

	const art = root.querySelector<HTMLElement>(".space-home-art");
	const hero = root.querySelector<HTMLElement>(".space-home-hero");
	if (art && hero && !reduceMotion.matches && finePointer.matches) {
		let pointerFrame = 0;
		let nextX = 0;
		let nextY = 0;

		const applyPointer = () => {
			pointerFrame = 0;
			art.style.setProperty("--space-motion-x", `${nextX.toFixed(1)}px`);
			art.style.setProperty("--space-motion-y", `${nextY.toFixed(1)}px`);
		};

		hero.addEventListener(
			"pointermove",
			(event: PointerEvent) => {
				const rect = hero.getBoundingClientRect();
				nextX =
					((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 22;
				nextY =
					((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 14;
				if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
			},
			{ passive: true },
		);
		hero.addEventListener("pointerleave", () => {
			nextX = 0;
			nextY = 0;
			if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
		});
	}

	if (!reduceMotion.matches && "IntersectionObserver" in window) {
		const selector = [
			".portfolio-page-intro",
			".portfolio-detail-heading",
			".portfolio-detail-preview",
			".portfolio-detail-body .markdown-content > *",
			".portfolio-project-grid > li",
			".portfolio-topic-card",
			".portfolio-post-row",
			".portfolio-live-repo-list a",
		].join(",");

		const nodes = [
			...root.querySelectorAll<HTMLElement>(selector),
		];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.classList.add("is-visible");
					observer.unobserve(entry.target);
				}
			},
			{ rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
		);

		nodes.forEach((node, index) => {
			// Keep above-the-fold content visible before the observer runs.
			const rect = node.getBoundingClientRect();
			node.setAttribute("data-motion-reveal", "");
			node.style.setProperty("--space-reveal-delay", `${(index % 4) * 55}ms`);
			if (rect.top < window.innerHeight * 0.9) {
				node.classList.add("is-visible");
			} else {
				observer.observe(node);
			}
		});
		root.classList.add("space-motion-ready");
	}
}
