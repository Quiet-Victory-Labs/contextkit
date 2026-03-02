import type { Manifest } from '@runcontext/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Finds a node by ID in the manifest and returns comprehensive info:
 * the node itself, its dependencies, dependents, applicable policies,
 * and owner info.
 */
export function explainNode(manifest: Manifest, id: string): CallToolResult {
  const index = manifest.indexes.byId[id];
  if (!index) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Node not found: ${id}` }, null, 2),
        },
      ],
    };
  }

  // Retrieve the node from the appropriate collection
  let node: Record<string, unknown> | undefined;
  switch (index.kind) {
    case 'concept':
      node = manifest.concepts[index.index] as unknown as Record<string, unknown>;
      break;
    case 'product':
      node = manifest.products[index.index] as unknown as Record<string, unknown>;
      break;
    case 'policy':
      node = manifest.policies[index.index] as unknown as Record<string, unknown>;
      break;
    case 'entity':
      node = manifest.entities[index.index] as unknown as Record<string, unknown>;
      break;
    case 'term':
      node = manifest.terms[index.index] as unknown as Record<string, unknown>;
      break;
    case 'owner':
      node = manifest.owners[index.index] as unknown as Record<string, unknown>;
      break;
  }

  if (!node) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Node data not found for: ${id}` }, null, 2),
        },
      ],
    };
  }

  // Find dependencies (concepts that this node dependsOn)
  const dependencies: Array<{ id: string; kind: string }> = [];
  const dependsOn = (node as { dependsOn?: string[] }).dependsOn;
  if (dependsOn) {
    for (const depId of dependsOn) {
      const depIndex = manifest.indexes.byId[depId];
      if (depIndex) {
        dependencies.push({ id: depId, kind: depIndex.kind });
      }
    }
  }

  // Find dependents (concepts that depend on this node)
  const dependents: Array<{ id: string; kind: string }> = [];
  for (const concept of manifest.concepts) {
    if (concept.dependsOn?.includes(id)) {
      dependents.push({ id: concept.id, kind: 'concept' });
    }
  }

  // Find applicable policies (policies whose rules reference this node's tags or ID)
  const applicablePolicies: Array<{ id: string; description: string }> = [];
  const nodeTags = (node as { tags?: string[] }).tags ?? [];
  for (const policy of manifest.policies) {
    const applies = policy.rules.some((rule) => {
      if (rule.when.conceptIds?.includes(id)) return true;
      if (rule.when.tagsAny?.some((tag) => nodeTags.includes(tag))) return true;
      return false;
    });
    if (applies) {
      applicablePolicies.push({ id: policy.id, description: policy.description });
    }
  }

  // Find owner info
  let ownerInfo: Record<string, unknown> | undefined;
  const ownerId = (node as { owner?: string }).owner;
  if (ownerId) {
    ownerInfo = manifest.owners.find((o) => o.id === ownerId) as unknown as Record<string, unknown>;
  }

  const result = {
    kind: index.kind,
    node,
    dependencies,
    dependents,
    applicablePolicies,
    owner: ownerInfo ?? null,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
