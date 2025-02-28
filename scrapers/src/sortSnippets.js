export function sortSnippets(snippets) {
  return Object.fromEntries(
    Object
      .entries(snippets)
      .sort((a, b) => {
        const aName = a[0].toLowerCase()
        const bName = b[0].toLowerCase()
        if (aName > bName) {
          return 1;
        }

        if (aName < bName) {
          return -1;
        }

        return 0;
      })
  )
}
