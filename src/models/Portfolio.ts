import {Wikifolio, Api} from '.'

const groupType = {
	0: 'Cash',
	610: 'Bonds',
	620: 'Equities',
	630: 'ETF',
	640: 'Structured products',
	650: 'Wikifolio certificates'
};

interface PortfolioItem {
	name: string;
	isin: string;
	quantity: number;
	averagePurchasePrice: number;
	ask: number;
	bid: number;
	close: number;
	percentage: number;
	link: string;
	issuer: any;
	mid: number;
	isLeveraged: boolean;
	isTicking: boolean;
	partnerName: string;
}

type PortfolioGroupName = 'equity' | 'structured' | 'cash' | 'n/a';
interface PortfolioGroup {
	type: number;
	name: PortfolioGroupName
	value: number;
	percentage: number;
	items: PortfolioItem[];
}

export class Portfolio {
	currency: string;
	totalValue: number;
	isSuper: boolean;
	groups: PortfolioGroup[];

	private static getGroupName(groupId: number): PortfolioGroupName {
		return groupType[groupId] || 'n/a';
	}

	constructor({groups, currency, totalValue, isSuper}: Portfolio, public wikifolio: Wikifolio){
		this.groups = groups.map(g => ({
			...g,
			name: Portfolio.getGroupName(g.type),
			items: g.items.map(i => ({
				...i,
				link: Api.url + i.link.substr(1)
			}))
		}));
		this.currency = currency;
		this.totalValue = totalValue;
		this.isSuper = isSuper;
	}

	public get items(): PortfolioItem[] {
		return ([] as PortfolioItem[]).concat(...this.groups.map(group => group.items))
	}
}