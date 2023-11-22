import { APL, AuthData, AplReadyResult, AplConfiguredResult } from './apl-interfaces';
import { UpstashAplMisconfiguredError, UpstashAplNotConfiguredError } from './upstash-errors';

export const UpstashAPLVariables = {
    UPSTASH_TOKEN: 'UPSTASH_TOKEN',
    UPSTASH_URL: 'UPSTASH_URL'
};

export class UpstashAPL implements APL {
    private restURL?: string;
    private restToken?: string;

    constructor(config?: { restURL: string; restToken: string; }) {
        const restURL = (config == null ? void 0 : config.restURL) || process.env[UpstashAPLVariables.UPSTASH_URL];
        const restToken = (config == null ? void 0 : config.restToken) || process.env[UpstashAPLVariables.UPSTASH_TOKEN];

        this.restURL = restURL;
        this.restToken = restToken;
    }

    async get(saleorApiUrl: string): Promise<AuthData | undefined> {
        return this.fetchDataFromUpstash(saleorApiUrl);
    }

    async set(authData: AuthData) {
        await this.saveDataToUpstash(authData);
    }

    async delete(saleorApiUrl: string) {
        await this.deleteDataFromUpstash(saleorApiUrl);
    }

    async getAll(): Promise<AuthData[]> {
        throw new Error("UpstashAPL does not support getAll method");
    }

    async isReady(): Promise<AplReadyResult> {
        const missingConf = [];

        if (!this.restToken) {
            missingConf.push("restToken");
        }
        if (!this.restURL) {
            missingConf.push("restURL");
        }
        if (missingConf.length > 0) {
            return {
                ready: false,
                error: new UpstashAplMisconfiguredError(missingConf)
            };
        }
        return {
            ready: true
        };
    }

    async isConfigured(): Promise<AplConfiguredResult> {
        return this.restToken && this.restURL ? {
            configured: true
        } : {
            configured: false,
            error: new UpstashAplNotConfiguredError()
        };
    }

    private async upstashRequest(request: any): Promise<any> {
        console.log("Sending request to Upstash");
        if (!this.restURL || !this.restToken) {
            throw new Error(
                "UpstashAPL is not configured. See https://github.com/saleor/saleor-app-sdk/blob/main/docs/apl.md"
            );
        }

        let response;

        try {
            response = await fetch(this.restURL, {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${this.restToken}`},
                body: JSON.stringify(request)
            });
        } catch (error) {
            console.log("Error during sending the data:", error);
            throw new Error(`UpstashAPL was unable to perform a request ${error}`);
        }

        const parsedResponse = await response.json();

        if (!response.ok || "error" in parsedResponse) {
            console.log(`Operation unsuccessful. Upstash API has responded with ${response.status} code`);
            if ("error" in parsedResponse) {
                console.log("Error message: %s", parsedResponse.error);
                throw new Error(
                    `Upstash APL was not able to perform operation. Status code: ${response.status}. Error: ${parsedResponse.error}`
                );
            }
            throw new Error(
                `Upstash APL was not able to perform operation. Status code: ${response.status}`
            );
        }
        console.log("Upstash service responded successfully");
        return parsedResponse.result;
    }

    private async saveDataToUpstash(authData: AuthData) {
        console.log("saveDataToUpstash() called with: %j", {
            saleorApiUrl: authData.saleorApiUrl,
            token: authData.token.substring(0, 4)
        });
        const data = JSON.stringify(authData);

        await this.upstashRequest(["SET", authData.saleorApiUrl + "@emails-and-messages", data]);
    }

    private async deleteDataFromUpstash(saleorApiUrl: string) {
        await this.upstashRequest(["DEL", saleorApiUrl]);
    }

    private async fetchDataFromUpstash(saleorApiUrl: string) {
        const result = await this.upstashRequest(["GET", saleorApiUrl + "@emails-and-messages"]);

        if (result) {
            return JSON.parse(result);
        }
        return void 0;
    }
}