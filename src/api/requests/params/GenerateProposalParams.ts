import * as _ from 'lodash';

export interface GenerateProposalParamsInterface {
    generateListingItem: boolean;
    toParamsArray(): boolean[];
}

export class GenerateProposalParams implements GenerateProposalParamsInterface {

    // Params. Initialised to default go here
    public generateListingItemTemplate = true;
    public generateListingItem = true;
    public listingItemHash: string;
    public generatePastProposal = false;
    public voteCount = 10;

    /**
     * generateParams[]:
     *
     * @param generateParams
     */
    constructor(generateParams: any[] = []) {
        if (!_.isEmpty(generateParams) ) {
            this.generateListingItemTemplate = generateParams[0] ? true : false;
            this.generateListingItem = generateParams[1] ? true : false;
            this.listingItemHash = generateParams[2] ? generateParams[2] : null;
            this.generatePastProposal = generateParams[3] ? generateParams[3] : false;
            this.voteCount = generateParams[4] ? generateParams[4] : this.voteCount;

            // if item hash was given, set generateListingItem to false
            this.generateListingItem = this.listingItemHash ? false : true;
        }
    }

    public toParamsArray(): any[] {
        return [
            this.generateListingItemTemplate,
            this.generateListingItem,
            this.listingItemHash,
            this.generatePastProposal,
            this.voteCount
        ];
    }
}
