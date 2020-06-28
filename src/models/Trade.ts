import {Api, Wikifolio} from '.'

type TradeOrderTypeSell = 'Sell' | 'SellLimit' | 'StopLoss' | 'SellStopLimit'
type TradeOrderTypeBuy = 'Buy' | 'BuyLimit'
type TradeOrderType = TradeOrderTypeBuy | TradeOrderTypeSell

export class Trade {
	id?: string;
	type?: 'buy' | 'sell';
	orderType?: TradeOrderType;
	name?: string;
	isin?: string;
	link?: string;
	isMainOrder?: boolean;
	mainOrderId?: string;
	subOrders?: any[];
	issuer?: number;
	securityType?: number;
	executionDate?: string;
	executedAt?: Date;
	performance?: number;
	weightage?: number;
	investmentUniverseGroupId?: string;
	isLeveraged?: boolean;
	linkParameter?: string;
	corporateActionType?: any;
	cash?: any;

	private static getType(orderType: TradeOrderType): 'buy' | 'sell' {
		return ['Buy', 'BuyLimit'].includes(orderType) ? 'buy' : 'sell';
	}

	constructor(data: Partial<Trade> = {}, public wikifolio: Wikifolio){
		Object.assign(this, <Partial<Trade>>{
			...data,
			type: Trade.getType(data.orderType!),
			link: Api.url + data.link!.substr(1),
			executedAt: new Date(data.executionDate!)
		});
	}
}