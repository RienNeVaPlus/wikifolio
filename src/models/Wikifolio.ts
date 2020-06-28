import {parseHtml, removeValues, toCurrency, toDate, toFloat, toInt, toQueryString} from '../utils'
import {Api, Trade, Portfolio} from '.'

export interface WikifolioIdentifier {
	id?: string;
	symbol?: string;
}

interface WikifolioParamCountry {
	country: string
	language: string
}

interface WikifolioParamPage {
	page: number
	pageSize: number
}

interface WikifolioParamCache {
	ignoreCache: boolean
}

interface WikifolioTradesParam extends WikifolioParamPage, WikifolioParamCountry {}
interface WikifolioAnalysisParam extends WikifolioParamCache, WikifolioParamCountry {}

type WikifolioSearchTag =
	// Anlageuniversum
	'aktde' | 'akteur' | 'akthot' | 'aktint' | 'etf' | 'anlagezert' | 'hebel'
	// Gehandelte Werte
	| 'schwer-d' | 'schwer-euro' | 'schwer-usa' | 'dividendenst' | 'ges-uni'
	// Handelsstil
	| 'regel' | 'divers' | 'heavy-T' | 'langf-st'
	// Qualitätsmerkmale
	| 'rising-star' | 'top-ten-t' | 'guter-ko' | 'regelm-akt' | 'bestseller' | 'treue-anl' | 'research'
	// Risiko/Rendite
	| 'high-perf' | 'money-man' | 'konti-wach'
	// Entscheidungsfindung
	| 'techanal' | 'fundamental' | 'sonstige'
	// Basiswährung
	| 'cureur' | 'curchf'

export interface WikifolioSearch {
	query: string
	tags: WikifolioSearchTag[]
	sortOrder: 'desc' | 'asc'
	sortBy: 'topwikis' | 'newestwiki' | 'firstem' | 'esgScore'
		| 'perfannually' | 'perfever' | 'perfemission' | 'perfytd' | 'perf12m' | 'perf6m' | 'perf3m' | 'perf1m'
		| 'sharperatio' | 'maxdraw' | 'aum' | 'buyint' | 'risk'
	startValue: number
	media: boolean
	private: boolean
	assetmanager: boolean
	theme: boolean
	super: boolean
	languageOnly: boolean
	investable: boolean
	realMoney: boolean
	savingplan: boolean
	LeverageProductsOnly: boolean
	WithoutLeverageProductsOnly: boolean

	perfever: string
	perfemission: string
	perfannually: string
	perfytd: string
	esgScore: string
	maxdraw: string
	aum: string
	risk: string

	perf12m: string
	perf6m: string
	perf3m: string
	perf1m: string
	sharperatio: string
	buyint: string
}

interface WikifolioComment {
	ref?: string
	html: string;
	text: string;
	createdAt: Date;
}

const regex = {
	script: new RegExp('<script type="text\/json">(.*)<\/script>', 'g')
};

export class Wikifolio {
	private static instances: {[key: string]: Wikifolio} = {};
	public static instance(identifier: WikifolioIdentifier | string, api: Api): Wikifolio {
		const id = typeof identifier === 'string' ? Wikifolio.parseIdentifier(identifier) : identifier;
		const hash = JSON.stringify(id);
		return this.instances[hash] = this.instances[hash]
			|| new Wikifolio(id, api);
	}

	/**
	 * Transforms a string into an identifier object
	 */
	private static parseIdentifier(identifier: string): WikifolioIdentifier {
		switch(identifier.length){
			case 8: return {symbol: 'wf'+identifier};
			case 10: return {symbol: identifier};
			default: return {id: identifier};
		}
	}

	/**
	 * Returns a list of found Wikifolio[]
	 */
	public static async search(param: Partial<WikifolioSearch> = {}, api: Api): Promise<Wikifolio[]> {
		const html = await api.request(`dynamic/${api.opt.locale.join('/')}/wikifoliosearch/search${toQueryString({
			_: + new Date(),
			tags: ['aktde','akteur','aktusa','akthot','aktint','etf','fonds','anlagezert','hebel'],
			media: true,
			private: true,
			assetmanager: true,
			theme: true,
			super: true,
			...param
		})}`);

		let match: null | RegExpExecArray;
		const wikis: Wikifolio[] = [];

		do {
			match = regex.script.exec(html);
			if(!match) continue;
			const json = JSON.parse(match[1]);
			const {
				wikifolioFullName, isWatchlisted,
				mainRankingValue, status, tags,
				shortDescription: title, rankingValues, wikifolioUrl,
				chartImgUrl, wikifolioId, wikifolioIsin,
				editor
			} = json;
			let wiki: Wikifolio = new Wikifolio(wikifolioFullName, api);
			const capital = rankingValues.find(i => i.label === 'Investiertes Kapital');
			const user = editor.name.split(' | ');
			Object.assign(wiki, <Wikifolio>{
				capital: capital ? toCurrency(capital.displayValue) : 0,
				rank: toFloat(mainRankingValue.displayValue),
				tags: tags.map(t => t.text),
				id: wikifolioId,
				isin: wikifolioIsin || undefined,
				userId: user[1],
				userName: user[0],
				userProfileUrl: Api.url + editor.url.substr(1),
				createdAt: toDate(rankingValues.find(i => i.label === 'Erstellungsdatum').displayValue),
				publishedAt: toDate(rankingValues.find(i => i.label === 'Erstemission').displayValue),
				fee: toInt(rankingValues.find(i => i.label === 'Performancegebühr').displayValue),
				maxdraw: toFloat(rankingValues.find(i => i.label === 'Maximaler Verlust (bisher)').displayValue),
				perfever: toFloat(rankingValues.find(i => i.label === 'Performance seit Beginn').displayValue),
				perfannually: toFloat(rankingValues.find(i => i.label === 'Ø-Performance pro Jahr').displayValue),
				title,
				isWatchlisted,
				chartImgUrl,
				wikifolioUrl: Api.url + wikifolioUrl.substr(1),
				status: status
			});
			wikis.push(wiki);
		} while(match != null);

		return wikis;
	}

	/**
	 * Returns watchlisted Wikifolio[]
	 */
	public static async watchlist(api: Api) {
		const html = await api.request(`${api.opt.locale.join('/')}/watchlist/${api.opt.locale[0]==='de'?'bearbeiten':'edit'}`);

		let match = regex.script.exec(html);
		const wikis: Wikifolio[] = [];

		const {searchResults} = JSON.parse(match![1]);
		for(const item of searchResults){
			const {
				isNotificationSet,
				rankings,
				status,
				wikifolioId: id,
				wikifolioIsin: isin,
				shortDescription: title,
				chartImgUrl,
				wikifolioUrl,
				editor,
				rankingValues
			} = item;

			const symbol = wikifolioUrl.split('/').slice(-1)[0];
			let wiki: Wikifolio = new Wikifolio({symbol, id}, api);
			const user = editor.name.split(' | ');

			Object.assign(wiki, removeValues(<Partial<Wikifolio>>{
				isin,
				title,
				userId: user[1],
				userName: user[0],
				userProfileUrl: Api.url + editor.url.substr(1),
				isNotificationSet,
				fee: toInt(rankingValues.find(i => i.label === 'Performancegebühr').displayValue),
				publishedAt: toDate(rankingValues.find(i => i.label === 'Erstemission').displayValue),
				createdAt: toDate(rankings.find(i => i.identifier === 'newestwiki').displayValue),
				rank: toFloat(rankings.find(i => i.identifier === 'topwikis').displayValue),
				buyint: toFloat(rankings.find(i => i.identifier === 'buyint').displayValue),
				bought30d: toFloat(rankings.find(i => i.identifier === 'bought30d').displayValue),
				perfever: toFloat(rankings.find(i => i.identifier === 'perfever').displayValue),
				perfemission: toFloat(rankings.find(i => i.identifier === 'perfemission').displayValue),
				perfytd: toFloat(rankings.find(i => i.identifier === 'perfytd').displayValue),
				capital: toCurrency(rankings.find(i => i.identifier === 'aum').displayValue),
				tradevol30d: toCurrency(rankings.find(i => i.identifier === 'tradevol30d').displayValue),
				perfbuy: toFloat(rankings.find(i => i.identifier === 'perfbuy').displayValue),
				perfannually: toFloat(rankings.find(i => i.identifier === 'perfannually').displayValue),
				perf60m: toFloat(rankings.find(i => i.identifier === 'perf60m').displayValue),
				perf36m: toFloat(rankings.find(i => i.identifier === 'perf36m').displayValue),
				perf12m: toFloat(rankings.find(i => i.identifier === 'perf12m').displayValue),
				perf52week: toFloat(rankings.find(i => i.identifier === 'perf52week').displayValue),
				perf6m: toFloat(rankings.find(i => i.identifier === 'perf6m').displayValue),
				perf3m: toFloat(rankings.find(i => i.identifier === 'perf3m').displayValue),
				perf1m: toFloat(rankings.find(i => i.identifier === 'perf1m').displayValue),
				maxdraw: toFloat(rankings.find(i => i.identifier === 'maxdraw').displayValue),
				sharperatio: toFloat(rankings.find(i => i.identifier === 'sharperatio').displayValue),
				esgScore: toFloat(rankings.find(i => i.identifier === 'esgScore').displayValue),
				risk: toFloat(rankings.find(i => i.identifier === 'risk').displayValue),
				chartImgUrl,
				wikifolioUrl: Api.url + wikifolioUrl.substr(1),
				status: status
			}));
			wikis.push(wiki);
		}

		return wikis;
	}

	constructor(identifiers: WikifolioIdentifier, private api: Api){
		Object.assign(this, identifiers);
	}

	sources: string[] = [];

	userId?: string;
	userName?: string;
	userProfileUrl?: string;

	id?: string;
	symbol?: string;

	wikifolioUrl?: string;
	isin?: string;
	wkn?: string;
	createdAt?: Date;
	publishedAt?: Date;

	status?: number;
	tags?: string[];

	capital?: number;
	title?: string;
	tradeidea?: string;
	highWatermark?: number;
	indexLevel?: number;
	fee?: number;
	liquidation?: number;
	tradingVolume?: number;

	decisionMaking?: string[];

	chartImgUrl?: string;
	// key?: string;
	investable?: boolean;
	containsLeverageProducts?: boolean;
	realMoney?: boolean;
	isWatchlisted?: boolean;
	name?: string;
	isOwned?: boolean;
	// perf?: Partial<Performance>;
	rank?: number; // Top-Wikifolio-Rangliste
	isSuper?: boolean; // Dachwikifolio
	sharperatio?: number;

	perf12m?: number;
	perf6m?: number;
	perf3m?: number;
	perf1m?: number;

	perfever?: number;
	perfemission?: number;
	perfannually?: number;
	perfytd?: number;
	esgScore?: number;
	maxdraw?: number;
	aum?: number;
	risk?: number;

	perftoday?: number;
	perfintra?: number;

	perf52weekHigh?: number;

	// price
	ask?: number;
	bid?: number;
	quantityLimitBid?: number;
	quantityLimitAsk?: number;
	priceCalculatedAt?: Date;
	priceValidUntil?: Date;
	midPrice?: number;
	showMidPrice?: boolean;
	currency?: string;
	isCurrencyConverted?: boolean;
	isTicking?: boolean;

	// watchlist wikifolios
	isNotificationSet?: boolean;
	buyint?: number;
	bought30d?: number;
	perf36m?: number;
	perf60m?: number;
	perf52week?: number;
	tradevol30d?: number;
	perfbuy?: number;

	comments?: WikifolioComment[];

	/**
	 * Fetch specific attributes
	 */
	private async fetch(...attributes: string[]): Promise<this> {
		// remove loaded attributes
		attributes = attributes.filter(a => !this[a]);

		if(attributes.includes('id')){
			await this.basics();
		}

		if(attributes.includes('symbol')){
			// TODO: find a way to get the symbol with only the id provided
			throw new Error('Missing Wikifolio symbol');
		}

		return this;
	}

	/**
	 * Fetch basic data, mainly required for obtaining the ID when only a symbol is provided
	 */
	public async basics(ignoreCache: boolean = false): Promise<this> {
		if(this.sources.includes('basics') && !ignoreCache) return this;
		await this.fetch('symbol');

		const {id, title, traderNickname, performanceEver, performanceToday} =
			await this.api.request(`api/wikifolio/${this.symbol}/basicdata`);

		this.sources.push('basics');

		return Object.assign(this, removeValues(<Partial<Wikifolio>>{
			id, title,
			userId: traderNickname,
			perfever: toFloat(performanceEver.displayValue),
			perftoday: toFloat(performanceToday.displayValue)
		}));
	}

	/**
	 * Fetches Wikifolio details from HTML (slow)
	 */
	public async details(ignoreCache: boolean = false): Promise<this> {
		if(this.sources.includes('details') && !ignoreCache) return this;
		this.fetch('symbol');

		const wikifolioUrl = `${this.api.opt.locale.join('/')}/w/${this.symbol}`;
		const {$, $$, attribute, string, int, float, date, currency} = parseHtml(
			await this.api.request(wikifolioUrl)
		);

		console.log('WTF', wikifolioUrl);
		const scripts = $$('body script');//.innerHTML.match(/wikifolio.data = ({.*)\;/g);
		const script = scripts[scripts.length-1];

		console.log('SCRIPT', script.innerHTML);
		Object.assign(this, removeValues(<Partial<Wikifolio>>{
			id: $('[data-wikifolioid]').dataset.wikifolioid,
			wikifolioUrl: Api.url + wikifolioUrl.substr(1),
			isin: string('.gtm-copy-isin'),
			title: string('.c-wf-head__title-text'),
			userId: string('.c-trader__name:nth-child(2)'),
			userName: string('.c-trader__name:nth-child(1)'),
			userUrl: Api.url + attribute('.gtm-profile-link', 'href').substr(1),
			capital: currency('.c-certificate__item--capital .c-certificate__item-value'),
			// MASTER DATA section
			createdAt: date('.c-masterdata__item:nth-child(2) .c-masterdata__item-value'),
			publishedAt: date('.c-certificate__key:nth-child(1) .c-certificate__key-value'),

			fee: int('.c-certificate__key:nth-child(3) .c-certificate__key-value'),
			liquidation: float('.c-certificate__key:nth-child(4) .c-certificate__key-value'),
			tradingVolume: currency('.c-certificate__key:nth-child(5) .c-certificate__key-value'),

			indexLevel: float('.c-masterdata__item:nth-child(3) .c-masterdata__item-value'),
			highWatermark: float('.c-masterdata__item:nth-child(4) .c-masterdata__item-value'),

			perfever: float('.c-ranking-box--large .c-ranking-item:nth-child(1)'),
			perf12m: float('.c-ranking-box--large .c-ranking-item:nth-child(2)'),
			perfannually: float('.c-ranking-box--large .c-ranking-item:nth-child(3)'),
			maxdraw: float('.c-ranking-box--small .c-ranking-item__value'),
			risk: float('.c-risk-factor'),

			isWatchlisted: !!$('.js-remove-from-watchlist'),
			containsLeverageProducts: !!$('.c-status-icon-wrapper[title*="Hebelprodukte"]'),
			investable: !!$('.c-status-icon-wrapper[title*="Investierbar"]'),
			realMoney: !!$('.c-status-icon-wrapper[title*="Real Money"]'),

			tradeidea: string('.js-tradeidea__content'),
			decisionMaking: $$('.c-wfdecision__item').map(e => e.textContent),

			comments: $$('.c-wfcomment article').map(e => {
				const body = e.querySelector('.c-wfcomment__item-content p')!;
				const d = String(e.querySelector('.c-wfcomment__item-date')!.textContent)
					.trim().split(/[. :]/g).map(n => parseInt(n));
				const ref = e.querySelector('.c-wfcomment__item-subheader-content');

				return removeValues({
					ref: ref ? String(ref.textContent).trim() : undefined,
					html: body.innerHTML,
					text: body.textContent,
					createdAt: new Date(d[2], d[1]-1, d[0], d[4]+2, d[5])
				})
			})
		}));

		this.sources.push('details');

		return this;
	}

	/**
	 * Fetch wikifolio price
	 */
	public async price(ignoreCache: boolean = false): Promise<this> {
		if(this.sources.includes('price') && !ignoreCache) return this;
		await this.fetch('id');

		const {
			ask, bid, quantityLimitBid, quantityLimitAsk, calculationDate, validUntilDate, midPrice,
			showMidPrice, currency, isCurrencyConverted, isTicking
		} = await this.api.request(`api/wikifolio/${this.id}/price`);

		Object.assign(this, <Partial<Wikifolio>>{
			hasPrice: true,
			ask, bid, quantityLimitBid, quantityLimitAsk, midPrice, showMidPrice, currency, isCurrencyConverted, isTicking,
			priceCalculatedAt: new Date(calculationDate),
			priceValidUntil: new Date(validUntilDate)
		});

		this.sources.push('price');

		return this;
	}

	/**
	 * Fetch portfolio
	 */
	public async portfolio(): Promise<Portfolio> {
		await this.fetch('symbol');

		const res = await this.api.request(
		`api/wikifolio/${this.symbol}/portfolio${toQueryString({
			country: this.api.opt.locale[0],
			language: this.api.opt.locale[1]
		})}`);

		this.isSuper = res.isSuperWikifolio;
		this.currency = res.currency;

		return new Portfolio({...res, isSuper: this.isSuper}, this);
	}

	/**
	 * Loads performance information
	 */
	public async analysis({ignoreCache, ...param}: Partial<WikifolioAnalysisParam> = {}): Promise<this> {
		if(this.sources.includes('analysis') && !ignoreCache) return this;
		await this.fetch('id');

		const {analysis: {keyFigures: l}} = await this.api.request(
			`api/wikifolio/${this.id}/analysis${toQueryString({
				country: this.api.opt.locale[0],
				language: this.api.opt.locale[1],
				...param
			})}`
		);

		Object.assign(this, removeValues(<Partial<Wikifolio>>{
			hasAnalysis: true,
			maxdraw: toFloat(l.find(i => i.label === 'Maximaler Verlust (bisher)').value),
			perf52weekHigh: toFloat(l.find(i => i.label == '52-Wochen-Hoch').value),
			sharperatio: toFloat(l.find(i => i.label === 'Sharpe Ratio').value),
			perfever: toFloat(l.find(i => i.label === 'Performance seit Beginn').value),
			perfemission: toFloat(l.find(i => i.label === 'Performance seit Emission').value),
			perfytd: toFloat(l.find(i => i.label === 'Performance seit Jahresbeginn').value),
			perfannually: toFloat(l.find(i => i.label === 'Ø-Performance pro Jahr').value),
			perf12m: toFloat(l.find(i => i.label === 'Performance 1 Jahr').value),
			perf6m: toFloat(l.find(i => i.label === 'Performance 6 Monate').value),
			perf3m: toFloat(l.find(i => i.label === 'Performance 3 Monate').value),
			perf1m: toFloat(l.find(i => i.label === 'Performance 1 Monat').value),
			perfintra: toFloat(l.find(i => i.label === 'Performance Intraday').value),
		}));

		this.sources.push('analysis');

		return this;
	}

	/**
	 * Fetches Trade[] sorted by date
	 */
	public async trades(param: Partial<WikifolioTradesParam> = {}){
		await this.fetch('id');

		const {tradeHistory: {pageCount, isSuperWikifolio, orders}} =	await this.api.request(
			`api/wikifolio/${this.id}/tradehistory${toQueryString({
				page: 0,
				pageSize: this.api.opt.defaults.pageSize,
				country: this.api.opt.locale[0],
				language: this.api.opt.locale[1],
				...param
			})}`
		) as {tradeHistory: {pageCount: number, isSuperWikifolio: boolean, orders: any[]}};

		this.isSuper = isSuperWikifolio;
		const trades: Trade[] = orders.map(order => new Trade(removeValues(order, null), this));

		return {
			pageCount,
			trades
		}
	}

	/**
	 * Fetch sustainability
	 */
	public async sustainability(): Promise<void> {
		console.error('Not yet implemented');
	}

	/**
	 * Toggle watchlist status of wikifolio
	 */
	public async watchlist(add: boolean = true): Promise<boolean> {
		await this.fetch('id');

		const res = await this.api.request({
			url: `${Api.url}dynamic/en/int/watchlistwikifolio/${add?'addwikifoliotowatchlist':'removewikifoliofromwatchlist'}`,
			method: 'post',
			json: {wikifolioId: this.id}
		});

		return res.success;
	}
}