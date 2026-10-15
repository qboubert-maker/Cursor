const SUBSTRINGS = [
  'fuck', 'fuk', 'phuck', 'shit', 'bitch', 'cunt', 'pussy', 'nigger', 'nigga', 'niggr',
  'faggot', 'fagot', 'retard', 'whore', 'slut', 'porn',   'asshole', 'badass', 'bastard', 'dick',
  'kike', 'chink', 'twat', 'wank', 'bollock', 'motherfucker', 'beaner', 'wetback',
  'towelhead', 'raghead', 'gook', 'tranny', 'shemale', 'rapist', 'nazi', 'hitler',
  'hentai', 'milf', 'boob', 'penis', 'vagina', 'dildo', 'horny', 'nude', 'tits',
  'whore', 'jizz', 'cumshot', 'blowjob', 'handjob', 'porn', 'xxx',
]

const TOKENS = [
  'ass', 'anus', 'anal', 'cum', 'scum', 'cock', 'fag', 'sex', 'tit', 'hell', 'damn', 'piss', 'crap',
  'poop', 'jap', 'spic', 'paki', 'coon', 'rape', 'nude', 'porn', 'xxx', 'kkk',
]

const plain = (value, zero = 'o') => String(value || '')
  .toLowerCase()
  .replace(/0/g, zero)
  .replace(/1|!/g, 'i')
  .replace(/3/g, 'e')
  .replace(/4|@/g, 'a')
  .replace(/5|\$/g, 's')
  .replace(/7/g, 't')
  .replace(/[^a-z]/g, '')

const fold = (value, zero = 'o') => plain(value, zero).replace(/(.)\1+/g, '$1')

const containsWord = (collapsed, literal, word) => {
  const folded = fold(word)
  return folded.length >= 4 ? collapsed.includes(folded) : literal.includes(word)
}

const readable = (slug, zero) => {
  const tokens = String(slug || '').split('-').filter(Boolean).map((part) => fold(part, zero))
  const collapsed = fold(String(slug || '').replace(/-/g, ''), zero)
  const literal = plain(String(slug || '').replace(/-/g, ''), zero)
  if (!collapsed) return false
  if (SUBSTRINGS.some((word) => containsWord(collapsed, literal, word))) return false
  if (TOKENS.some((word) => collapsed === fold(word) || tokens.includes(fold(word)))) return false
  return true
}

export const cleanLinkName = (slug) => readable(slug, 'o') && readable(slug, 'u')
