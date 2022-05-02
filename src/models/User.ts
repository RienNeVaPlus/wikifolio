import {Api, Wikifolio} from '.'
import {parseHtml, removeValues, toFloat} from '../utils'

export class User {
  private static instances: {[key: string]: User} = {}
  public static instance(api: Api, nickname: string): User {
    return this.instances[nickname] = this.instances[nickname] || new User({nickname}, api)
  }

  sources = new Set<string>()
  watchlist: string[] = []

  id?: string
  nickname?: string
  name?: string
  seenAt?: Date
  registeredAt?: Date
  profileUrl?: string
  topWikifolio?: Wikifolio

  constructor(user: Partial<User> = {}, public api: Api){
    this.set(user)
  }

  public set(user: Partial<User>){
    return Object.assign(this, removeValues(user))
  }

  /**
   * Fetch specific attributes (not in use yet)
   */
  private async fetch(...attributes: string[]): Promise<this> {
    // remove loaded attributes
    attributes = attributes.filter(a => !this[a])

    if(attributes.includes('nickname')){
      throw new Error('Missing user.nickname')
    }

    return this
  }

  /**
   * Fetches User details from HTML (slow)
   */
  public async details(ignoreCache: boolean = false): Promise<this> {
    if(this.sources.has('details') && !ignoreCache) return this
    await this.fetch('nickname')

    const profileUrl = `${this.api.opt.locale.join('/')}/p/${this.nickname}`
    const {$, string, date} = parseHtml(
      await this.api.request(profileUrl)
    )

    const {gtmData: {userGtmId: id}} = JSON.parse($('#global-data').innerHTML)

    const $topWikifolio = $('.c-wikifolio-card__card-url') as HTMLAnchorElement
    const topWikifolio = Wikifolio.instance(this.api, $topWikifolio.href.split('/').slice(-1)[0])

    topWikifolio.set({
      title: $topWikifolio.querySelector('.c-icon-name__text')!.innerHTML.trim(),
      performanceEver: toFloat($topWikifolio.querySelector('.c-ranking-item__value')!.innerHTML),
      performanceOneYear: toFloat($topWikifolio.querySelector('.c-ranking-item:nth-child(2) .c-ranking-item__value')!.innerHTML),
      user: this,
      sources: topWikifolio.sources.add('user.details')
    })

    this.set({
      id,
      nickname: string('.c-trader-name__text'),
      name: string('.c-trader-profile__fullname'),
      profileUrl: Api.url + profileUrl.substr(1),
      seenAt: date('.c-trader-profile__trader-info-item:nth-child(2) .u-fw-sb'),
      registeredAt: date('.c-trader-profile__trader-info-item:nth-child(3) .u-fw-sb'),
      topWikifolio,
      sources: this.sources.add('details')
    })

    return this
  }

  public async wikifolios(){
    await this.fetch('nickname')

    const {groupedWikifolioCards,wikifoliosWatchlistedByUser} =
      await this.api.request(`api/profile/${this.nickname}/wikifolios?loadAllWikis=true`)

    this.watchlist = wikifoliosWatchlistedByUser

    return ([] as Wikifolio[]).concat(
      ...Object.keys(groupedWikifolioCards).map(key =>
        groupedWikifolioCards[key].wikifolioResults.map(w => {
          const symbol = w.wikifolioLink.split('/').slice(-1)[0]
          return Wikifolio.instance(this.api, {symbol, id: w.id}).set({
            category: key,
            sources: new Set<string>().add('user.wikifolios')
          })
        })
      )
    )
  }
}
