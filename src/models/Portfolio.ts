import {Wikifolio, Api} from '.'
import {removeValues} from '../utils'

const groupType = {
  0: 'cash',
  610: 'bonds',
  620: 'equities',
  630: 'etfs',
  640: 'structured-products',
  650: 'wikifolio-certificates'
}

interface PortfolioItem {
  name: string
  isin: string
  quantity: number
  averagePurchasePrice: number
  ask: number
  bid: number
  close: number
  percentage: number
  link: string
  issuer: any
  mid: number
  isLeveraged: boolean
  isTicking: boolean
  partnerName: string
}

type PortfolioGroupName = 'cash' | 'bonds' | 'equities' | 'etfs' | 'structured-products' | 'wikifolio-certificates'

interface PortfolioGroup {
  type: number
  name: PortfolioGroupName
  value: number
  percentage: number
  items: PortfolioItem[]
}

export class Portfolio {
  currency: string
  totalValue: number
  isSuper: boolean
  groups: PortfolioGroup[] = []

  private static getGroupName(groupId: number): PortfolioGroupName {
    return groupType[groupId] || 'n/a'
  }

  constructor({groups, currency, totalValue, isSuper}: Portfolio, public wikifolio: Wikifolio){
    this.currency = currency
    this.totalValue = totalValue
    this.isSuper = isSuper
    this.groups = groups.map(g => ({
      ...g,
      name: Portfolio.getGroupName(g.type),
      items: g.items.map(i => ({
        ...i,
        link: i.link.startsWith('http') ? i.link : Api.url + i.link.substr(1)
      }))
    }))
  }

  public set(portfolio: Partial<Portfolio>){
    return Object.assign(this, removeValues(portfolio))
  }

  public get items(): PortfolioItem[] {
    return ([] as PortfolioItem[]).concat(...this.groups.map(group => group.items))
  }
}
