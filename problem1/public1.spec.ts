import '@ton/test-utils';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Proposal } from '../output/solution1_Proposal';
import { getStateSizeForAccount } from '../utils/gas';

describe('solution1', () => {
    let blockchain: Blockchain;
    let proposal: SandboxContract<Proposal>;

    let deployer: SandboxContract<TreasuryContract>;
    let voter: SandboxContract<TreasuryContract>;

    beforeEach(async () => {
        // Initialize the blockchain before each test
        blockchain = await Blockchain.create();

        let startTime = Math.floor(Date.now() / 1000);
        blockchain.now = startTime;

        // Create a contract from init()
        proposal = blockchain.openContract(
            await Proposal.fromInit({
                $$type: 'Init',
                proposalId: 0n,
                votingEndingAt: BigInt(Math.floor(Date.now() / 1000)) + 24n * 60n * 60n,
            }),
        );

        deployer = await blockchain.treasury('deployer');
        voter = await blockchain.treasury('voter');

        // deploy contract
        const deployResult = await proposal.send(
            deployer.getSender(),
            {
                value: toNano('0.01'),
            },
            null, // empty message, handled by `receive()` without parameters
        );
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: proposal.address,
            success: true,
        });
    });

    it('solution1', async () => {
        // vote
        await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );

        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 1n, noCount: 0n });
    });

    it('Anyone can deploy the proposal contract', async () => {
        const deployer2 = await blockchain.treasury('deployer2');
        const proposal2 = blockchain.openContract(
            await Proposal.fromInit({
                $$type: 'Init',
                proposalId: 1n,
                votingEndingAt: BigInt(Math.floor(Date.now() / 1000)) + 24n * 60n * 60n,
            }),
        );
        await proposal2.send(
            deployer2.getSender(),
            {
                value: toNano('0.01'),
            },
            null, // empty message, handled by `receive()` without parameters
        );
        await proposal2.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: false,
            },
        );
        expect(await proposal2.getProposalState()).toMatchObject({ yesCount: 0n, noCount: 1n });
    });

    it('The voting is time-limited: no more votes can be accepted after the specified duration.', async () => {
        blockchain.now = (blockchain.now||0) + 24 * 60 * 60 + 1; // move time forward by 1 day and 1 second

        // vote
        const voteResult = await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );
        expect(voteResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposal.address,
            success: false,
            exitCode: 48492,
        });

        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 0n, noCount: 0n });
    });

    it('Only the first hundred (100) votes can be accepted.', async () => {
        for (let i = 0; i < 100; i++) {
            const voter = await blockchain.treasury(`voter${i}`);
            await proposal.send(
                voter.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Vote',
                    value: true,
                },
            );
            expect(await proposal.getProposalState()).toMatchObject({ yesCount: BigInt(i + 1), noCount: 0n });
        }

        const voter = await blockchain.treasury(`voter_last`);
        await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );
        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 100n, noCount: 0n });
    });
    
    it('Any voter can vote only one time.', async () => {
        // vote
        await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );
        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 1n, noCount: 0n });
        // try to vote again
        const voteResult = await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );
        expect(voteResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposal.address,
            success: false,
            exitCode: 51288,
        });
        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 1n, noCount: 0n });
    });

    // it('testsss', async () => {
    //     const account = await getStateSizeForAccount(blockchain, proposal.address);

    //     const time_delta = 24 * 60 * 60;
    //     const bit_price = 1;
    //     const cell_price = 500;

    //     // expect(account).toMatchObject({ cells: 1, bits: 0 });

    //     const bits_fees = account.bits * bit_price;
    //     const cells_fees = account.cells * cell_price;
    //     const total_fees = bits_fees + cells_fees;

    //     // expect(Math.ceil(total_fees * time_delta / 2 ^ 16)).toBe(0);
    // });
});