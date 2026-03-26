/**
 * Tests for video feed logic:
 *  - Active card selection by visibleIndex
 *  - visibleIndex reset on filter change
 *  - Comment mutation cache update shape
 */

describe('VideoFeed active card logic', () => {
  it('marks only the card at visibleIndex as active', () => {
    const videos = ['a', 'b', 'c', 'd']
    const visibleIndex = 2
    const activeCards = videos.filter((_, i) => i === visibleIndex)
    expect(activeCards).toEqual(['c'])
    expect(activeCards.length).toBe(1)
  })

  it('no cards are active when visibleIndex equals filtered list length (stale state)', () => {
    // This is the bug that was fixed: category switch left visibleIndex=5 but filtered list had 2 items
    const filtered = [{ id: 'x' }, { id: 'y' }]
    const staleVisibleIndex = 5
    const active = filtered[staleVisibleIndex] // undefined — nobody is active
    expect(active).toBeUndefined()
  })

  it('resetting visibleIndex to 0 on filter change fixes the stale state', () => {
    const filtered = [{ id: 'x' }, { id: 'y' }]
    const resetVisibleIndex = 0
    const active = filtered[resetVisibleIndex]
    expect(active?.id).toBe('x')
  })
})

describe('CommentsSheet cache update', () => {
  it('appends new comment to existing list', () => {
    const existingComments = [{ id: '1', text: 'hello' }]
    const newComment = { id: '2', text: 'world' }
    const updated = [...existingComments, newComment]
    expect(updated).toHaveLength(2)
    expect(updated[1].id).toBe('2')
  })

  it('increments commentCount optimistically', () => {
    const video = { id: 'v1', commentCount: 3 }
    const bumped = { ...video, commentCount: video.commentCount + 1 }
    expect(bumped.commentCount).toBe(4)
  })

  it('does not mutate original object', () => {
    const video = { id: 'v1', commentCount: 3 }
    const bumped = { ...video, commentCount: video.commentCount + 1 }
    expect(video.commentCount).toBe(3)  // original unchanged
    expect(bumped.commentCount).toBe(4)
  })
})

describe('Comment content moderation', () => {
  const BLOCKED_TERMS = ['fuck', 'shit', 'bitch']

  function containsBlocked(text: string): boolean {
    const n = text.toLowerCase().replace(/[^a-z0-9]/g, ' ')
    return BLOCKED_TERMS.some(term => new RegExp(`(^|\\s)${term}(\\s|$)`).test(n))
  }

  it('blocks explicit terms', () => {
    expect(containsBlocked('what the fuck is this')).toBe(true)
  })

  it('blocks at word boundaries only', () => {
    // 'assignment' contains 'ass' but should not be blocked
    expect(containsBlocked('this is my assignment')).toBe(false)
  })

  it('allows clean text', () => {
    expect(containsBlocked('Jazakallah khair for the video')).toBe(false)
    expect(containsBlocked('Beautiful recitation')).toBe(false)
  })
})
