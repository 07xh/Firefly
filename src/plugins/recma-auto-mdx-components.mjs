/**
 * Auto-import Firefly MDX UI components at compile time.
 *
 * The source Markdown/MDX is never rewritten. Imports are added to the MDX
 * compiler's ESTree only, and only for component names actually referenced by
 * the document. Explicit local declarations/imports take precedence.
 */

const COMPONENT_SOURCE = "@/components/firefly-mdx";
const COMPONENT_NAMES = new Set([
  "Badge",
  "StepItem",
  "Steps",
  "TabGroup",
  "Timeline",
  "TimelineItem",
]);

function componentNameFromJsxName(name) {
  if (!name || typeof name !== "object") return null;
  if (name.type === "JSXIdentifier") return name.name || null;
  if (name.type === "JSXMemberExpression") {
    return componentNameFromJsxName(name.object);
  }
  return null;
}

function collectTopLevelBindings(program) {
  const names = new Set();

  for (const statement of program.body || []) {
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers || []) {
        if (specifier.local?.name) names.add(specifier.local.name);
      }
      continue;
    }

    if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations || []) {
        collectPatternNames(declaration.id, names);
      }
      continue;
    }

    if (
      (statement.type === "FunctionDeclaration" ||
        statement.type === "ClassDeclaration") &&
      statement.id?.name
    ) {
      names.add(statement.id.name);
    }
  }

  return names;
}

function collectPatternNames(pattern, names) {
  if (!pattern || typeof pattern !== "object") return;
  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return;
  }
  if (pattern.type === "RestElement") {
    collectPatternNames(pattern.argument, names);
    return;
  }
  if (pattern.type === "AssignmentPattern") {
    collectPatternNames(pattern.left, names);
    return;
  }
  if (pattern.type === "ArrayPattern") {
    for (const item of pattern.elements || []) collectPatternNames(item, names);
    return;
  }
  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties || []) {
      collectPatternNames(
        property.type === "RestElement" ? property.argument : property.value,
        names,
      );
    }
  }
}

function referencedComponents(program) {
  const used = new Set();
  const seen = new WeakSet();

  function visit(value) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (value.type === "JSXOpeningElement" || value.type === "JSXClosingElement") {
      const name = componentNameFromJsxName(value.name);
      if (name && COMPONENT_NAMES.has(name)) used.add(name);
    } else if (
      value.type === "JSXIdentifier" &&
      COMPONENT_NAMES.has(value.name)
    ) {
      // Covers JSX trees emitted by MDX implementations that expose names
      // without retaining an explicit JSXOpeningElement parent.
      used.add(value.name);
    } else if (
      value.type === "Identifier" &&
      COMPONENT_NAMES.has(value.name)
    ) {
      // Covers ASTs where a component reference has already been lowered.
      used.add(value.name);
    }

    for (const [key, child] of Object.entries(value)) {
      if (
        key === "parent" ||
        key === "loc" ||
        key === "range" ||
        key === "start" ||
        key === "end" ||
        key === "leadingComments" ||
        key === "trailingComments" ||
        key === "innerComments"
      ) continue;

      if (Array.isArray(child)) {
        for (const item of child) visit(item);
      } else if (child && typeof child === "object") {
        visit(child);
      }
    }
  }

  visit(program);
  return used;
}

function createImportDeclaration(names) {
  return {
    type: "ImportDeclaration",
    specifiers: names.map((name) => ({
      type: "ImportSpecifier",
      imported: { type: "Identifier", name },
      local: { type: "Identifier", name },
    })),
    source: {
      type: "Literal",
      value: COMPONENT_SOURCE,
      raw: JSON.stringify(COMPONENT_SOURCE),
    },
  };
}

export default function recmaAutoMdxComponents() {
  return (tree) => {
    if (!tree || tree.type !== "Program" || !Array.isArray(tree.body)) return;

    const used = referencedComponents(tree);
    if (!used.size) return;

    const declared = collectTopLevelBindings(tree);
    const missing = [...used].filter((name) => !declared.has(name));
    if (!missing.length) return;

    // Add imports to the compiler AST, not to the source text stored in GitHub.
    tree.body.unshift(createImportDeclaration(missing));
  };
}
