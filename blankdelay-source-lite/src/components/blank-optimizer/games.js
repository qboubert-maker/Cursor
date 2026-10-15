const cover = (file) => `${import.meta.env.BASE_URL}optimizer-games/${file}`

export const OPTIMIZER_GAMES = [
  { id: 'cs2', title: 'Counter-Strike 2', platform: 'Steam', cover: cover('cs2.jpg') },
  { id: 'valorant', title: 'Valorant', platform: 'Riot', cover: cover('valorant.jpg') },
  { id: 'lol', title: 'League of Legends', platform: 'Riot', cover: cover('lol.jpg') },
  { id: 'fortnite', title: 'Fortnite', platform: 'Epic', cover: cover('fortnite-itachi.jpg') },
  { id: 'minecraft', title: 'Minecraft', platform: 'Minecraft Launcher', cover: cover('minecraft.jpg') },
  { id: 'rocket-league', title: 'Rocket League', platform: 'Steam', cover: cover('rocket-league.jpg') },
  { id: 'warzone', title: 'Call of Duty: Warzone', platform: 'Steam', cover: cover('warzone.jpg') },
  { id: 'apex', title: 'Apex Legends', platform: 'Steam', cover: cover('apex.jpg') },
  { id: 'gta5', title: 'Grand Theft Auto V', platform: 'Steam', cover: cover('gta5.jpg') },
  { id: 'fivem', title: 'FiveM', platform: 'FiveM', cover: cover('fivem.jpg') },
  { id: 'marvel-rivals', title: 'Marvel Rivals', platform: 'Steam', cover: cover('marvel-rivals.jpg') },
  { id: 'r6-siege', title: 'Rainbow Six Siege', platform: 'Steam', cover: cover('r6-siege.jpg') },
  { id: 'overwatch2', title: 'Overwatch 2', platform: 'Battle.net', cover: cover('overwatch2.jpg') },
  { id: 'destiny-2', title: 'Destiny 2', platform: 'Steam', cover: cover('destiny-2.jpg') },
  { id: 'helldivers-2', title: 'Helldivers 2', platform: 'Steam', cover: cover('helldivers-2.jpg') },
  { id: 'elden-ring', title: 'Elden Ring', platform: 'Steam', cover: cover('elden-ring.jpg') },
  { id: 'pubg', title: 'PUBG: Battlegrounds', platform: 'Steam', cover: cover('pubg.jpg') },
]
