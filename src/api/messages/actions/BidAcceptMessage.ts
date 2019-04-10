// Copyright (c) 2017-2019, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import { IsEnum, IsNotEmpty } from 'class-validator';
import { ActionMessageInterface } from './ActionMessageInterface';
import { MessageBody } from '../../../core/api/MessageBody';
import { MPAction } from 'omp-lib/dist/interfaces/omp-enums';
import { MPA_ACCEPT, PaymentDataAccept} from 'omp-lib/dist/interfaces/omp';
import {KVS} from 'omp-lib/dist/interfaces/common';
import { HashableMessageInterface } from './HashableMessageInterface';

export class BidAcceptMessage extends MessageBody implements ActionMessageInterface, MPA_ACCEPT, HashableMessageInterface {

    @IsEnum(MPAction)
    @IsNotEmpty()
    public type: MPAction.MPA_ACCEPT;

    @IsNotEmpty()
    public bid: string;

    @IsNotEmpty()
    public seller: {
        payment: PaymentDataAccept;
    };

    public objects: KVS[] = [];

    @IsNotEmpty()
    public generated: number;
    @IsNotEmpty()
    public hash: string;

    public toHashable(): MPA_ACCEPT {
        const msg = <MPA_ACCEPT>{
            type: this.type,
            generated: this.generated,
            bid: this.bid,
            seller: this.seller
        };

        if (this.objects) {
            msg.objects = this.objects;
        }
        
        return msg;
    }
}
