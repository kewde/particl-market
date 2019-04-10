// Copyright (c) 2017-2019, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import { IsEnum, IsNotEmpty } from 'class-validator';
import { ActionMessageInterface } from './ActionMessageInterface';
import { MessageBody } from '../../../core/api/MessageBody';
import { MPAction} from 'omp-lib/dist/interfaces/omp-enums';
import { MPA_REJECT, MPA} from 'omp-lib/dist/interfaces/omp';
import {KVS} from 'omp-lib/dist/interfaces/common';
import { HashableMessageInterface } from './HashableMessageInterface';

export class BidRejectMessage extends MessageBody implements ActionMessageInterface, MPA_REJECT, HashableMessageInterface {

    @IsEnum(MPAction)
    @IsNotEmpty()
    public type: MPAction.MPA_REJECT;

    @IsNotEmpty()
    public bid: string;

    public objects?: KVS[];

    @IsNotEmpty()
    public generated: number;
    @IsNotEmpty()
    public hash: string;

    public toHashable(): MPA_REJECT {
        const msg =  <MPA_REJECT>{
            type: this.type,
            generated: this.generated,
            bid: this.bid
        };

        if (this.objects) {
            msg.objects = this.objects;
        }
        
        return msg;
    }
}
