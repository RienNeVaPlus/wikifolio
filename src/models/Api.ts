import {User, Wikifolio, WikifolioIdentifier, WikifolioSearch} from '.'
import {JSDOM, requestPromise} from '../utils'

const jar = requestPromise.jar();
const request = requestPromise.defaults({jar});

export interface RequestOpt extends requestPromise.OptionsWithUrl {}

interface Options {
	email: string
	password: string
	locale?: [string, string]
	defaults?: Defaults
	timeout?: number
}

interface Defaults {
	pageSize: number
}

interface Opt extends Options {
	locale: [string, string]
	cookie?: string
	timeout: number
	defaults: Defaults
}

let timeout: NodeJS.Timeout;

export class Api {
	static url = 'https://www.wikifolio.com/';

	opt: Opt;

	constructor(options: Options){
		this.opt = {
			locale: ['de', 'de'],
			timeout: 60 * 60 * 12,
			...options,
			defaults: {
				pageSize: 50,
				...(options.defaults||{})
			}
		};
	}

	private async auth(): Promise<boolean> {
		let { opt: {cookie} } = this;

		if(cookie)
			return false;

		const {email, password} = this.opt;

		if(!email || !password)
			throw new Error('Missing credentials');

		const url = Api.url + 'dynamic/de/de/login/login';

		// request form for session vars
		const form = await request({url, resolveWithFullResponse:true});

		const {window: {document}} = new JSDOM(form.body);
		const __RequestVerificationToken = (document.querySelector('[name=__RequestVerificationToken]') as HTMLInputElement).value;
		const ufprt = (document.querySelector('[name=ufprt]') as HTMLInputElement).value;

		// login with session vars
		const res = await request.post({
			url,
			formData: {
				Username: email,
				Password: password,
				ufprt, __RequestVerificationToken
			},
			simple: false,
			resolveWithFullResponse: true
		});

		if(!res.request.headers['cookie'])
			throw new Error('Login failed, Cookie not found');

		this.opt.cookie = res.request.headers['cookie'];

		if(timeout) clearTimeout(timeout);
		timeout = setTimeout(
			() => this.opt.cookie = undefined,
			this.opt.timeout * 1000
		);

		return true;
	}

	public async request(arg: string | RequestOpt, authorize: boolean = true, fullResponse: boolean = false): Promise<any> {
		const options: RequestOpt = typeof arg === 'string' ? {url: Api.url+arg} : arg;
		options.simple = false;
		options.resolveWithFullResponse = fullResponse;
		options.headers = {
			'X-Requested-With': 'XMLHttpRequest'
		};

		if(authorize)
			await this.auth();

		let res = await request(options);

		if(!fullResponse && typeof res === 'string' && String(options.url).includes('/api/')){
			try { res = JSON.parse(res); } catch(e){ throw new Error('Invalid JSON'); }
			if(res.message === 'Authorization has been denied for this request.')
				throw new Error(res.message);
		}

		return res;
	}

	public wikifolio(idOrSymbol: WikifolioIdentifier | string): Wikifolio {
		return Wikifolio.instance(this, idOrSymbol);
	}

	public search(search: Partial<WikifolioSearch>): Promise<Wikifolio[]> {
		return Wikifolio.search(this, search);
	}

	public watchlist(){
		return Wikifolio.watchlist(this);
	}

	public user(nickname: string){
		return User.instance(this, nickname);
	}
}