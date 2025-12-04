/**
 * Domain grouping utility for organizing domains by root domain
 */

export interface DomainGroup {
  label: string
  domains: string[]
}

export interface GroupedDomains {
  favorites: string[]
  groups: DomainGroup[]
}

/**
 * Extract root domain from a full domain
 * e.g., "inspirex.anonady.com" -> "anonady.com"
 */
function getRootDomain(domain: string): string {
  const parts = domain.split('.')
  if (parts.length <= 2) return domain

  // Get the last 2 parts (root domain)
  return parts.slice(-2).join('.')
}

/**
 * Group domains by root domain
 * Optionally sort by frequency of each root domain
 */
export function groupDomainsByRoot(
  domains: string[],
  favorites?: string[]
): GroupedDomains {
  const rootMap = new Map<string, string[]>()
  const domainSet = new Set(domains)

  // Group domains by root domain
  domains.forEach(domain => {
    const root = getRootDomain(domain)
    if (!rootMap.has(root)) {
      rootMap.set(root, [])
    }
    rootMap.get(root)!.push(domain)
  })

  // Sort domains within each group
  rootMap.forEach(domains => {
    domains.sort()
  })

  // Sort groups by root domain name (alphabetically)
  const sortedRoots = Array.from(rootMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))

  const groups: DomainGroup[] = sortedRoots.map(([root, domainList]) => ({
    label: root,
    domains: domainList
  }))

  // Filter favorites to only include domains that actually exist
  const validFavorites = (favorites || []).filter(fav => domainSet.has(fav))

  return {
    favorites: validFavorites,
    groups
  }
}

/**
 * Get suggested favorites from domains
 * Returns the most common root domains or the first few domains
 */
export function getSuggestedFavorites(domains: string[], count: number = 5): string[] {
  const grouped = groupDomainsByRoot(domains)
  const suggested: string[] = []

  // Get first domain from each group until we have enough
  for (const group of grouped.groups) {
    if (suggested.length >= count) break
    suggested.push(group.domains[0])
  }

  return suggested
}
