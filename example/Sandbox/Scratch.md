# Scratch

Try things here. Some ideas:

1. Add `type: Topic` to this note's frontmatter, then add `broader:: [[Computer Science]]` below. Watch it appear in the block.
2. Add `-contradicts:: [[Typed Links in Practice]] {why: "small sample"}` and see a negative edge.
3. Link to a note that does not exist, such as `knows:: [[Zoe]]`, then create `Zoe.md` and see the stub become a real node.

```graph-query
MATCH (a)-[r]->(b)
WHERE a.title = "Scratch" OR b.title = "Scratch"
RETURN a, r, b
```

## Your edges

mentioned_in:: [[Cypher manual]]
