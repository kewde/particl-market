// Copyright (c) 2017-2018, The Particl Market developers
// Distributed under the GPL software license, see the accompanying
// file COPYING or https://github.com/particl/particl-market/blob/develop/LICENSE

import * from 'jest';
import { Logger as LoggerType } from '../../src/core/Logger';
import { BlackBoxTestUtil } from './lib/BlackBoxTestUtil';
import { Commands } from '../../src/api/commands/CommandEnumType';
import { CreatableModel } from '../../src/api/enums/CreatableModel';
import { GenerateListingItemTemplateParams } from '../../src/api/requests/params/GenerateListingItemTemplateParams';
import * as resources from 'resources';
import { BidMessageType } from '../../src/api/enums/BidMessageType';
import { SearchOrder } from '../../src/api/enums/SearchOrder';
import { OrderStatus } from '../../src/api/enums/OrderStatus';
import { ImageDataProtocolType } from '../../src/api/enums/ImageDataProtocolType';

describe('Happy Buy Flow', () => {

    jasmine.DEFAULT_TIMEOUT_INTERVAL = process.env.JASMINE_TIMEOUT;

    const log: LoggerType = new LoggerType(__filename);

    // const testUtilNode0 = new BlackBoxTestUtil(0);
    const randomBoolean: boolean = Math.random() >= 0.5;
    const testUtilSellerNode = new BlackBoxTestUtil(randomBoolean ? 0 : 1);  // SELLER
    const testUtilBuyerNode = new BlackBoxTestUtil(randomBoolean ? 1 : 0);  // BUYER

    const templateCommand = Commands.TEMPLATE_ROOT.commandName;
    const templatePostCommand = Commands.TEMPLATE_POST.commandName;
    const templateGetCommand = Commands.TEMPLATE_GET.commandName;
    const imageCommand = Commands.ITEMIMAGE_ROOT.commandName;
    const imageAddCommand = Commands.ITEMIMAGE_ADD.commandName;
    const listingItemCommand = Commands.ITEM_ROOT.commandName;
    const listingItemGetCommand = Commands.ITEM_GET.commandName;
    const bidCommand = Commands.BID_ROOT.commandName;
    const bidSendCommand = Commands.BID_SEND.commandName;
    const bidSearchCommand = Commands.BID_SEARCH.commandName;
    const bidAcceptCommand = Commands.BID_ACCEPT.commandName;
    const orderCommand = Commands.ORDER_ROOT.commandName;
    const orderSearchCommand = Commands.ORDER_SEARCH.commandName;
    const escrowCommand = Commands.ESCROW_ROOT.commandName;
    const escrowLockCommand = Commands.ESCROW_LOCK.commandName;
    const escrowReleaseCommand = Commands.ESCROW_RELEASE.commandName;
    const daemonCommand = Commands.DAEMON_ROOT.commandName;

    let sellerProfile: resources.Profile;
    let buyerProfile: resources.Profile;
    let defaultMarket: resources.Market;

    let listingItemTemplatesSellerNode: resources.ListingItemTemplate[];
    let listingItemReceivedSellerNode: resources.ListingItem;
    let listingItemReceivedBuyerNode: resources.ListingItem;

    let bidOnSellerNode: resources.Bid;
    let bidOnBuyerNode: resources.Bid;

    let orderOnSellerNode: resources.Order;
    let orderOnBuyerNode: resources.Order;

    const PAGE = 0;
    const PAGE_LIMIT = 10;
    const ORDERING = SearchOrder.ASC;
    const DAYS_RETENTION = 2;

    beforeAll(async () => {

        // await testUtilNode0.cleanDb();
        // await testUtilNode1.cleanDb();
        // await testUtilNode2.cleanDb();

        log.debug('SELLER IS NODE' + (randomBoolean ? 1 : 2));
        log.debug('BUYER IS NODE' + (randomBoolean ? 2 : 1));

        // get seller and buyer profiles
        sellerProfile = await testUtilSellerNode.getDefaultProfile();
        expect(sellerProfile.id).toBeDefined();

        buyerProfile = await testUtilBuyerNode.getDefaultProfile();
        expect(buyerProfile.id).toBeDefined();

        // log.debug('sellerProfile: ', JSON.stringify(sellerProfile, null, 2));
        // log.debug('buyerProfile: ', JSON.stringify(buyerProfile, null, 2));
        log.debug('sellerProfile: ', sellerProfile.address);
        log.debug('buyerProfile: ', buyerProfile.address);

        defaultMarket = await testUtilSellerNode.getDefaultMarket();
        expect(defaultMarket.id).toBeDefined();

        log.debug('defaultMarket: ', JSON.stringify(defaultMarket, null, 2));

        const generateListingItemTemplateParams = new GenerateListingItemTemplateParams([
            true,   // generateItemInformation
            true,   // generateItemLocation
            true,   // generateShippingDestinations
            false,   // generateItemImages
            true,   // generatePaymentInformation
            true,   // generateEscrow
            true,   // generateItemPrice
            true,   // generateMessagingInformation
            false,    // generateListingItemObjects
            false,  // generateObjectDatas
            sellerProfile.id,    // profileId
            false,   // generateListingItem
            defaultMarket.id     // marketId
        ]).toParamsArray();

        // generate listingItemTemplate
        listingItemTemplatesSellerNode = await testUtilSellerNode.generateData(
            CreatableModel.LISTINGITEMTEMPLATE, // what to generate
            1,                          // how many to generate
            true,                       // return model
            generateListingItemTemplateParams   // what kind of data to generate
        ) as resources.ListingItemTemplates[];

        expect(listingItemTemplatesSellerNode[0].id).toBeDefined();
        expect(listingItemTemplatesSellerNode[0].hash).toBeDefined();

        // we should be also able to get the template
        const templateGetRes: any = await testUtilSellerNode.rpc(templateCommand, [templateGetCommand, listingItemTemplatesSellerNode[0].id]);
        templateGetRes.expectJson();
        templateGetRes.expectStatusCode(200);
        const result: resources.ListingItemTemplate = templateGetRes.getBody()['result'];

        log.debug('listingItemTemplates[0].hash:', listingItemTemplatesSellerNode[0].hash);
        log.debug('result.hash:', result.hash);
        expect(result.hash).toBe(listingItemTemplatesSellerNode[0].hash);

        // add image
        const base64Image = await testUtilSellerNode.getRandomBase64Image();
        const imageAddRes: any = await testUtilSellerNode.rpc(imageCommand, [
            imageAddCommand,
            listingItemTemplatesSellerNode[0].id,
            'uniqueid',
            ImageDataProtocolType.LOCAL,
            'BASE64',
            base64Image
        ]);
        imageAddRes.expectJson();
        imageAddRes.expectStatusCode(200);
        const imageResult: resources.ListingItemTemplate = imageAddRes.getBody()['result'];
        // log.debug('imageResult:', imageResult);

        // start with clean outputs incase something went wrong earlier
        // incase something went wrong last time.. unlock the locked outputs
        let response: any = await testUtilSellerNode.rpc(daemonCommand, [
            'lockunspent',
            true
        ]);
        response.expectJson();
        response.expectStatusCode(200);

        response = await testUtilBuyerNode.rpc(daemonCommand, [
            'lockunspent',
            true
        ]);
        response.expectJson();
        response.expectStatusCode(200);

    });

    test('SELLER POSTS MP_ITEM_ADD to the default marketplace', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER POSTS MP_ITEM_ADD to the default marketplace');
        log.debug('========================================================================================');

        await testUtilSellerNode.waitFor(5);

        const templatePostRes: any = await testUtilSellerNode.rpc(templateCommand, [
            templatePostCommand,
            listingItemTemplatesSellerNode[0].id,
            DAYS_RETENTION,
            defaultMarket.id
        ]);
        templatePostRes.expectJson();
        templatePostRes.expectStatusCode(200);

        // make sure we got the expected result from posting the template
        const result: any = templatePostRes.getBody()['result'];
        expect(result.result).toBe('Sent.');

        log.debug('==[ post ListingItemTemplate /// seller -> marketplace ]================================');
        log.debug('result.msgid: ' + result.msgid);
        log.debug('item.id: ' + listingItemTemplatesSellerNode[0].id);
        log.debug('item.hash: ' + listingItemTemplatesSellerNode[0].hash);
        log.debug('item.title: ' + listingItemTemplatesSellerNode[0].ItemInformation.title);
        log.debug('item.desc: ' + listingItemTemplatesSellerNode[0].ItemInformation.shortDescription);
        log.debug('item.category: [' + listingItemTemplatesSellerNode[0].ItemInformation.ItemCategory.id + '] '
            + listingItemTemplatesSellerNode[0].ItemInformation.ItemCategory.name);
        log.debug('========================================================================================');

    });

    test('SELLER RECEIVES MP_ITEM_ADD posted from sellers node, ListingItem is created and matched with the existing ListingItemTemplate', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER RECEIVES MP_ITEM_ADD posted from sellers node, ListingItem is created and matched with the existing ListingItemTemplate');
        log.debug('========================================================================================');

        // wait for some time to make sure it's received
        await testUtilSellerNode.waitFor(10);

        const response: any = await testUtilSellerNode.rpcWaitFor(
            listingItemCommand,
            [listingItemGetCommand, listingItemTemplatesSellerNode[0].hash],
            8 * 60,
            200,
            'hash',
            listingItemTemplatesSellerNode[0].hash
        );
        response.expectJson();
        response.expectStatusCode(200);

        // make sure we got the expected result from seller node
        // -> meaning item hash was matched with the existing template hash
        const result: resources.ListingItem = response.getBody()['result'];

        expect(result).toBeDefined();
        delete result.ItemInformation.ItemImages;
        log.debug('result.hash: ', result.hash);
        log.debug('listingItemTemplatesSellerNode[0].hash: ', listingItemTemplatesSellerNode[0].hash);
        expect(result.hash).toBe(listingItemTemplatesSellerNode[0].hash);
        log.debug('result.ListingItemTemplate.hash: ', listingItemTemplatesSellerNode[0].hash);

        if (!result.ListingItemTemplate) {
            log.debug('WHYYYY: ', JSON.stringify(result, null, 2));
        }
        expect(result.ListingItemTemplate.hash).toBe(listingItemTemplatesSellerNode[0].hash);
        // sometimes result.ListingItemTemplate is null!!!
        // ...and sometimes missing a price

        // store ListingItem for later tests
        listingItemReceivedSellerNode = result;

        log.debug('==> SELLER received MP_ITEM_ADD.');

    }, 600000); // timeout to 600s

    test('BUYER RECEIVES MP_ITEM_ADD posted from sellers node, ListingItem is created', async () => {

        log.debug('========================================================================================');
        log.debug('BUYER RECEIVES MP_ITEM_ADD posted from sellers node, ListingItem is created');
        log.debug('========================================================================================');

        await testUtilSellerNode.waitFor(5);

        const itemGetRes: any = await testUtilBuyerNode.rpcWaitFor(
            listingItemCommand,
            [listingItemGetCommand, listingItemTemplatesSellerNode[0].hash],
            8 * 60,
            200,
            'hash',
            listingItemTemplatesSellerNode[0].hash
        );
        itemGetRes.expectJson();
        itemGetRes.expectStatusCode(200);

        const result: resources.ListingItem = itemGetRes.getBody()['result'];
        expect(result.hash).toBe(listingItemTemplatesSellerNode[0].hash);

        // store ListingItem for later tests
        listingItemReceivedBuyerNode = result;

        log.debug('==> SELLER received MP_ITEM_ADD.');

    }, 600000); // timeout to 600s

    test('BUYER POSTS MPA_BID for the ListingItem to the seller', async () => {

        log.debug('========================================================================================');
        log.debug('BUYER POSTS MPA_BID for the ListingItem to the seller');
        log.debug('========================================================================================');

        const bidSendCommandParams = [
            bidSendCommand,
            listingItemReceivedBuyerNode.hash,
            buyerProfile.id,
            buyerProfile.ShippingAddresses[0].id,
            'colour',   // TODO: make sure created template/item has these options and test that these end up in the Order
            'black',
            'size',
            'xl'
        ];

        const bidSendRes: any = await testUtilBuyerNode.rpc(bidCommand, bidSendCommandParams);
        bidSendRes.expectJson();
        bidSendRes.expectStatusCode(200);

        const result: any = bidSendRes.getBody()['result'];
        log.debug('result', result);
        expect(result.result).toBe('Sent.');

        log.debug('==[ send Bid /// buyer node -> seller node ]===================================');
        log.debug('msgid: ' + result.msgid);
        log.debug('item.hash: ' + listingItemReceivedBuyerNode.hash);
        log.debug('item.seller: ' + listingItemReceivedBuyerNode.seller);
        log.debug('bid.bidder: ' + buyerProfile.address);
        log.debug('===============================================================================');

    });

    test('Bid should have been created on buyer node after posting the MPA_BID, BidMessageType.MPA_BID', async () => {

        log.debug('========================================================================================');
        log.debug('Bid should have been created on buyer node after posting the MPA_BID, BidMessageType.MPA_BID');
        log.debug('========================================================================================');

        // wait for some time to make sure the Bid has been created
        await testUtilBuyerNode.waitFor(5);

        const bidSearchCommandParams = [
            bidSearchCommand,
            PAGE, PAGE_LIMIT, ORDERING,
            listingItemReceivedBuyerNode.hash,
            BidMessageType.MPA_BID,
            '*',
            buyerProfile.address
        ];

        const bidSearchRes: any = await testUtilBuyerNode.rpcWaitFor(
            bidCommand,
            bidSearchCommandParams,
            8 * 60,
            200,
            '[0].action',
            BidMessageType.MPA_BID.toString()
        );
        bidSearchRes.expectJson();
        bidSearchRes.expectStatusCode(200);

        const result: resources.Bid = bidSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].action).toBe(BidMessageType.MPA_BID);
        expect(result[0].ListingItem.hash).toBe(listingItemReceivedBuyerNode.hash);
        expect(result[0].bidder).toBe(buyerProfile.address);
        expect(result[0].ListingItem.seller).toBe(sellerProfile.address);

        // there should be no relation to template on the buyer side
        expect(result[0].ListingItem.ListingItemTemplate).not.toBeDefined();

        bidOnBuyerNode = result[0];

        log.debug('==> Bid created on BUYER node.');

    }, 600000); // timeout to 600s

    test('SELLER RECEIVES MPA_BID posted from buyers node, BidMessageType.MPA_BID', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER RECEIVES MPA_BID posted from buyers node, BidMessageType.MPA_BID');
        log.debug('========================================================================================');

        // wait for some time to make sure the Bid has been created
        // await testUtilBuyerNode.waitFor(5);

        const bidSearchCommandParams = [
            bidSearchCommand,
            PAGE, PAGE_LIMIT, ORDERING,
            listingItemReceivedBuyerNode.hash,
            BidMessageType.MPA_BID,
            '*',
            buyerProfile.address
        ];

        const bidSearchRes: any = await testUtilSellerNode.rpcWaitFor(
            bidCommand,
            bidSearchCommandParams,
            8 * 60,
            200,
            '[0].action',
            BidMessageType.MPA_BID.toString()
        );
        bidSearchRes.expectJson();
        bidSearchRes.expectStatusCode(200);

        const result: resources.Bid = bidSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].action).toBe(BidMessageType.MPA_BID);
        expect(result[0].bidder).toBe(buyerProfile.address);
        expect(result[0].ListingItem).toBeDefined();
        expect(result[0].ListingItem.seller).toBe(sellerProfile.address);
        expect(result[0].ListingItem.hash).toBe(listingItemReceivedSellerNode.hash);

        // there should be a relation to template on the seller side
        expect(result[0].ListingItem.ListingItemTemplate).toBeDefined();

        // the relation should match the hash of the template that was created earlier on node1
        expect(result[0].ListingItem.ListingItemTemplate.hash).toBe(listingItemTemplatesSellerNode[0].hash);

        // todo: check for correct biddata
        bidOnSellerNode = result[0];

        log.debug('==> SELLER received MPA_BID.');

    }, 600000); // timeout to 600s

    test('SELLER POSTS MPA_ACCEPT', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER POSTS MPA_ACCEPT');
        log.debug('========================================================================================');

        await testUtilSellerNode.waitFor(5);

        expect(bidOnSellerNode).toBeDefined();

        const bidAcceptCommandParams = [
            bidAcceptCommand,
            bidOnSellerNode.id
        ];

        const response: any = await testUtilSellerNode.rpc(bidCommand, bidAcceptCommandParams);
        response.expectJson();
        response.expectStatusCode(200);

        // make sure we got the expected result from sending the bid
        const result: any = response.getBody()['result'];
        expect(result.result).toBe('Sent.');

        log.debug('==[ accept Bid /// seller (node1) -> buyer (node2) ]=============================');
        log.debug('msgid: ' + result.msgid);
        log.debug('item.hash: ' + bidOnSellerNode.ListingItem.hash);
        log.debug('bid.id: ' + bidOnSellerNode.id);
        log.debug('bid.bidder: ' + bidOnSellerNode.bidder);
        log.debug('bid.ListingItem.seller: ' + bidOnSellerNode.ListingItem.seller);
        log.debug('=================================================================================');

    }, 600000); // timeout to 600s

    test('Bid should have been updated on seller node after posting the MPA_ACCEPT', async () => {

        log.debug('========================================================================================');
        log.debug('Bid should have been updated on seller node after posting the MPA_ACCEPT');
        log.debug('========================================================================================');

        // wait for some time to make sure the Bid has been updated
        await testUtilSellerNode.waitFor(10);

        const bidSearchCommandParams = [
            bidSearchCommand,
            PAGE, PAGE_LIMIT, ORDERING,
            bidOnSellerNode.ListingItem.hash,
            BidMessageType.MPA_ACCEPT,
            '*',
            buyerProfile.address
        ];

        const bidSearchRes: any = await testUtilSellerNode.rpcWaitFor(
            bidCommand,
            bidSearchCommandParams,
            8 * 60,
            200,
            '[0].action',
            BidMessageType.MPA_ACCEPT.toString()
        );
        bidSearchRes.expectJson();
        bidSearchRes.expectStatusCode(200);

        const result: resources.Bid = bidSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].action).toBe(BidMessageType.MPA_ACCEPT);
        expect(result[0].ListingItem.hash).toBe(bidOnSellerNode.ListingItem.hash);
        expect(result[0].bidder).toBe(buyerProfile.address);
        expect(result[0].ListingItem.seller).toBe(sellerProfile.address);

        // there should be a relation to template on the seller side
        expect(result[0].ListingItem.ListingItemTemplate.hash).toBe(listingItemTemplatesSellerNode[0].hash);

        bidOnSellerNode = result[0];

        log.debug('==> Bid updated on SELLER node.');
    });

    test('Order should have been created on seller node after posting the MPA_ACCEPT', async () => {

        log.debug('========================================================================================');
        log.debug('Order should have been created on seller node after posting the MPA_ACCEPT');
        log.debug('========================================================================================');

        expect(bidOnSellerNode).toBeDefined();

        // wait for some time to make sure the Order has been created
        await testUtilSellerNode.waitFor(10);

        // log.debug('bidOnSellerNode: ', JSON.stringify(bidOnSellerNode, null, 2));
        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnSellerNode.ListingItem.hash,
            OrderStatus.AWAITING_ESCROW,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilSellerNode.rpcWaitFor(
            orderCommand,
            orderSearchCommandParams,
            8 * 60,
            200,
            '[0].OrderItems[0].status',
            OrderStatus.AWAITING_ESCROW.toString()
        );
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].hash).toBeDefined(); // TODO: should match bidOnSellerNode.BidDatas[orderHash]
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);
        expect(result[0].OrderItems).toHaveLength(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.AWAITING_ESCROW);
        expect(result[0].OrderItems[0].itemHash).toBe(bidOnSellerNode.ListingItem.hash);

        orderOnSellerNode = result[0];

        log.debug('==> Order created on SELLER node.');

    }, 600000); // timeout to 600s

    test('BUYER RECEIVES MPA_ACCEPT posted from sellers node, BidMessageType.MPA_ACCEPT', async () => {

        log.debug('========================================================================================');
        log.debug('BUYER RECEIVES MPA_ACCEPT posted from sellers node, BidMessageType.MPA_ACCEPT');
        log.debug('========================================================================================');

        expect(orderOnSellerNode).toBeDefined();

        await testUtilBuyerNode.waitFor(10);

        // TODO: when we first get the template hash, store it in originalTemplateHash and use that for searches and expects
        // same for other similar cases...

        const bidSearchCommandParams = [
            bidSearchCommand,
            PAGE, PAGE_LIMIT, ORDERING,
            bidOnBuyerNode.ListingItem.hash,
            BidMessageType.MPA_ACCEPT,
            '*',
            buyerProfile.address
        ];

        const bidSearchRes: any = await testUtilBuyerNode.rpcWaitFor(
            bidCommand,
            bidSearchCommandParams,
            8 * 60,
            200,
            '[0].action',
            BidMessageType.MPA_ACCEPT.toString()
        );
        bidSearchRes.expectJson();
        bidSearchRes.expectStatusCode(200);

        const result: resources.Bid = bidSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].action).toBe(BidMessageType.MPA_ACCEPT);
        expect(result[0].bidder).toBe(buyerProfile.address);
        expect(result[0].ListingItem.seller).toBe(sellerProfile.address);
        expect(result[0].ListingItem.hash).toBe(listingItemReceivedSellerNode.hash);

        // there should be no relation to template on the buyer side
        expect(result[0].ListingItem.ListingItemTemplate).not.toBeDefined();

        // todo: check for correct biddata
        bidOnBuyerNode = result[0];

        log.debug('==> BUYER received MPA_ACCEPT.');
    }, 600000); // timeout to 600s

    test('Order should have been created on buyer node after receiving the MPA_ACCEPT, OrderStatus.AWAITING_ESCROW', async () => {

        log.debug('========================================================================================');
        log.debug('Order should have been created on buyer node after receiving the MPA_ACCEPT, OrderStatus.AWAITING_ESCROW');
        log.debug('========================================================================================');

        expect(bidOnBuyerNode).toBeDefined();

        // wait for some time to make sure the Order has been created
        await testUtilBuyerNode.waitFor(5);

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnBuyerNode.ListingItem.hash,
            OrderStatus.AWAITING_ESCROW,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilBuyerNode.rpc(orderCommand, orderSearchCommandParams);
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].hash).toBeDefined(); // TODO: bidNode1.BidDatas[orderHash]
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);
        expect(result[0].OrderItems).toHaveLength(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.AWAITING_ESCROW);
        expect(result[0].OrderItems[0].itemHash).toBe(bidOnSellerNode.ListingItem.hash);

        orderOnBuyerNode = result[0];

        log.debug('==> Order created on BUYER node.');

    });

    test('After Order is created, we should also find Bids using the OrderStatus', async () => {

        log.debug('========================================================================================');
        log.debug('Bid should now be found using OrderStatus');
        log.debug('========================================================================================');

        expect(orderOnBuyerNode).toBeDefined();

        // wait for some time to make sure the Order has been created
        await testUtilBuyerNode.waitFor(5);

        const response: any = await testUtilBuyerNode.rpc(bidCommand, [
            bidSearchCommand,
            PAGE, PAGE_LIMIT, ORDERING,
            bidOnBuyerNode.ListingItem.hash,
            OrderStatus.AWAITING_ESCROW
        ]);
        response.expectJson();
        response.expectStatusCode(200);
        const result: any = response.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].action).toBe(BidMessageType.MPA_ACCEPT);
        expect(result[0].ListingItem.hash).toBe(bidOnBuyerNode.ListingItem.hash);
        expect(result[0].OrderItem.status).toBe(OrderStatus.AWAITING_ESCROW);

        log.debug('==> Updated Bid found on BUYER node.');
    });

    test('BUYER POSTS MPA_LOCK', async () => {

        log.debug('========================================================================================');
        log.debug('BUYER POSTS MPA_LOCK');
        log.debug('========================================================================================');

        const escrowLockCommandParams = [
            escrowLockCommand,
            orderOnBuyerNode.OrderItems[0].id,
            'random-nonce-nse',
            'WANTITPLEASETAKEMYMONEYS!'
        ];

        const escrowLockRes: any = await testUtilBuyerNode.rpc(escrowCommand, escrowLockCommandParams);
        escrowLockRes.expectJson();
        escrowLockRes.expectStatusCode(200);

        // make sure we got the expected result from sending the bid
        const result: any = escrowLockRes.getBody()['result'];
        log.debug('result', result);
        expect(result.result).toBe('Sent.');

        log.debug('==[ lock Escrow /// buyer (node2) -> seller (node1) ]============================');
        log.debug('msgid: ' + result.msgid);
        log.debug('order.hash: ' + orderOnBuyerNode.hash);
        log.debug('order.buyer: ' + orderOnBuyerNode.buyer);
        log.debug('order.seller: ' + orderOnBuyerNode.seller);
        log.debug('order.id: ' + orderOnBuyerNode.id);
        log.debug('order.orderItem.id: ' + orderOnBuyerNode.OrderItems[0].id);
        log.debug('=================================================================================');

    });

    test('Order should have been updated on buyer node after sending the MPA_LOCK, OrderStatus.ESCROW_LOCKED', async () => {

        log.debug('========================================================================================');
        log.debug('Order should have been updated on buyer node after sending the MPA_LOCK, OrderStatus.ESCROW_LOCKED');
        log.debug('========================================================================================');

        await testUtilBuyerNode.waitFor(5);

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnBuyerNode.ListingItem.hash,
            OrderStatus.ESCROW_LOCKED,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilBuyerNode.rpc(orderCommand, orderSearchCommandParams);
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].hash).toBeDefined(); // TODO: bidNode1.BidDatas[orderHash]
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);
        expect(result[0].OrderItems).toHaveLength(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.ESCROW_LOCKED);
        expect(result[0].OrderItems[0].itemHash).toBe(bidOnSellerNode.ListingItem.hash);

        orderOnBuyerNode = result[0];

        log.debug('==> Updated Bid found on BUYER node.');
    });

    test('SELLER RECEIVES MPA_LOCK posted from buyers node, OrderStatus.ESCROW_LOCKED', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER RECEIVES MPA_LOCK posted from buyers node, OrderStatus.ESCROW_LOCKED');
        log.debug('========================================================================================');

        expect(orderOnBuyerNode).toBeDefined();

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnSellerNode.ListingItem.hash,
            OrderStatus.ESCROW_LOCKED,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilSellerNode.rpcWaitFor(
            orderCommand,
            orderSearchCommandParams,
            8 * 60,
            200,
            '[0].OrderItems[0].status',
            OrderStatus.ESCROW_LOCKED.toString()
        );
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.ESCROW_LOCKED);
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);

        orderOnSellerNode = result[0];

        log.debug('==> SELLER received MPA_LOCK.');

    }, 600000); // timeout to 600s

    test('SELLER POSTS MPA_RELEASE, indicating that the item has been sent', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER POSTS MPA_RELEASE, indicating that the item has been sent');
        log.debug('========================================================================================');

        expect(orderOnSellerNode).toBeDefined();

        await testUtilSellerNode.waitFor(5);

        const escrowReleaseCommandParams = [
            escrowReleaseCommand,
            orderOnSellerNode.OrderItems[0].id,
            'tracking1234'
        ];

        const escrowReleaseRes: any = await testUtilSellerNode.rpc(escrowCommand, escrowReleaseCommandParams);
        escrowReleaseRes.expectJson();
        escrowReleaseRes.expectStatusCode(200);

        const result: any = escrowReleaseRes.getBody()['result'];
        log.debug('result', JSON.stringify(result, null, 2));
        expect(result.result).toBe('Sent.');

        log.debug('==[ release Escrow /// seller (node1) -> buyer (node2) ]=========================');
        log.debug('msgid: ' + result.msgid);
        log.debug('order.hash: ' + orderOnBuyerNode.hash);
        log.debug('order.buyer: ' + orderOnBuyerNode.buyer);
        log.debug('order.seller: ' + orderOnBuyerNode.seller);
        log.debug('order.id: ' + orderOnBuyerNode.id);
        log.debug('order.orderItem.id: ' + orderOnBuyerNode.OrderItems[0].id);
        log.debug('=================================================================================');

    });

    test('Order should have been updated on seller node after sending the MPA_RELEASE, OrderStatus.SHIPPING', async () => {

        log.debug('========================================================================================');
        log.debug('Order should have been updated on seller node after sending the MPA_RELEASE, OrderStatus.SHIPPING');
        log.debug('========================================================================================');

        await testUtilSellerNode.waitFor(5);

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnSellerNode.ListingItem.hash,
            OrderStatus.SHIPPING,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilSellerNode.rpc(orderCommand, orderSearchCommandParams);
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].hash).toBeDefined(); // TODO: bidNode1.BidDatas[orderHash]
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);
        expect(result[0].OrderItems).toHaveLength(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.SHIPPING);
        expect(result[0].OrderItems[0].itemHash).toBe(bidOnSellerNode.ListingItem.hash);

        orderOnSellerNode = result[0];

        log.debug('==> Order updated on SELLER node.');

    });

    test('BUYER RECEIVES MPA_RELEASE posted from sellers node, OrderStatus.SHIPPING', async () => {

        log.debug('========================================================================================');
        log.debug('BUYER RECEIVES MPA_RELEASE posted from sellers node, OrderStatus.SHIPPING');
        log.debug('========================================================================================');

        expect(orderOnSellerNode).toBeDefined();

        await testUtilBuyerNode.waitFor(5);

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnBuyerNode.ListingItem.hash,
            OrderStatus.SHIPPING,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilBuyerNode.rpcWaitFor(
            orderCommand,
            orderSearchCommandParams,
            8 * 60,
            200,
            '[0].OrderItems[0].status',
            OrderStatus.SHIPPING.toString()
        );
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.SHIPPING);
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);

        orderOnBuyerNode = result[0];

        log.debug('==> BUYER received MPA_RELEASE.');

    }, 600000); // timeout to 600s

    test('BUYER POSTS MPA_RELEASE, indicating that the item has been received', async () => {

        log.debug('========================================================================================');
        log.debug('BUYER POSTS MPA_RELEASE, indicating that the item has been received');
        log.debug('========================================================================================');

        expect(orderOnBuyerNode).toBeDefined();

        await testUtilBuyerNode.waitFor(5);

        const escrowReleaseCommandParams = [
            escrowReleaseCommand,
            orderOnBuyerNode.OrderItems[0].id,
            'kthanxbye'
        ];

        const escrowReleaseRes: any = await testUtilBuyerNode.rpc(escrowCommand, escrowReleaseCommandParams);
        escrowReleaseRes.expectJson();
        escrowReleaseRes.expectStatusCode(200);

        const result: any = escrowReleaseRes.getBody()['result'];
        log.debug('result', JSON.stringify(result, null, 2));
        expect(result.result).toBe('Sent.');

        log.debug('==[ release Escrow /// buyer (node2) -> seller (node1) ]=========================');
        log.debug('msgid: ' + result.msgid);
        log.debug('order.hash: ' + orderOnBuyerNode.hash);
        log.debug('order.buyer: ' + orderOnBuyerNode.buyer);
        log.debug('order.seller: ' + orderOnBuyerNode.seller);
        log.debug('order.id: ' + orderOnBuyerNode.id);
        log.debug('order.orderItem.id: ' + orderOnBuyerNode.OrderItems[0].id);
        log.debug('=================================================================================');

    });

    test('Order should have been updated on buyer node after sending the MPA_RELEASE, OrderStatus.COMPLETE', async () => {

        log.debug('========================================================================================');
        log.debug('Order should have been updated on buyer node after sending the MPA_RELEASE, OrderStatus.COMPLETE');
        log.debug('========================================================================================');

        await testUtilBuyerNode.waitFor(5);

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnBuyerNode.ListingItem.hash,
            OrderStatus.COMPLETE,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilBuyerNode.rpc(orderCommand, orderSearchCommandParams);
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].hash).toBeDefined(); // TODO: bidNode1.BidDatas[orderHash]
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);
        expect(result[0].OrderItems).toHaveLength(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.COMPLETE);
        expect(result[0].OrderItems[0].itemHash).toBe(bidOnBuyerNode.ListingItem.hash);

        orderOnSellerNode = result[0];

        log.debug('==> Order updated on BUYER node.');

    });

    test('SELLER RECEIVES MPA_RELEASE posted from buyers node, OrderStatus.COMPLETE', async () => {

        log.debug('========================================================================================');
        log.debug('SELLER RECEIVES MPA_RELEASE posted from buyers node, OrderStatus.COMPLETE');
        log.debug('========================================================================================');

        expect(orderOnSellerNode).toBeDefined();

        const orderSearchCommandParams = [
            orderSearchCommand,
            bidOnSellerNode.ListingItem.hash,
            OrderStatus.COMPLETE,
            buyerProfile.address,
            sellerProfile.address,
            SearchOrder.ASC
        ];

        const orderSearchRes: any = await testUtilBuyerNode.rpcWaitFor(
            orderCommand,
            orderSearchCommandParams,
            8 * 60,
            200,
            '[0].OrderItems[0].status',
            OrderStatus.COMPLETE.toString()
        );
        orderSearchRes.expectJson();
        orderSearchRes.expectStatusCode(200);

        const result: resources.Order = orderSearchRes.getBody()['result'];
        expect(result.length).toBe(1);
        expect(result[0].OrderItems[0].status).toBe(OrderStatus.COMPLETE);
        expect(result[0].buyer).toBe(buyerProfile.address);
        expect(result[0].seller).toBe(sellerProfile.address);

        orderOnBuyerNode = result[0];

        log.debug('==> SELLER received MPA_RELEASE.');

    }, 600000); // timeout to 600s


    test('Should have no locked outputs left', async () => {

        // incase something went wrong.. unlock the locked outputs
        let response: any = await testUtilSellerNode.rpc(daemonCommand, [
            'listlockunspent'
        ]);
        response.expectJson();
        response.expectStatusCode(200);
        let result = response.getBody()['result'];
        expect(result.length).toBe(0);

        response = await testUtilBuyerNode.rpc(daemonCommand, [
            'listlockunspent'
        ]);
        response.expectJson();
        response.expectStatusCode(200);
        result = response.getBody()['result'];
        expect(result.length).toBe(0);

        log.debug('==> No locked outputs left.');

    }, 600000); // timeout to 600s

});
