import '@ton/test-utils';
import { Blockchain } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Proposal } from '../output/solution2_Proposal';
import { ProposalMaster } from '../output/solution2_ProposalMaster';

it('solution2', async () => {
    const blockchain = await Blockchain.create();

    // init master contract
    const proposalMaster = blockchain.openContract(
        await ProposalMaster.fromInit(),
    );

    // deploy master contract
    const masterDeployer = await blockchain.treasury('deployer');
    await proposalMaster.send(
        masterDeployer.getSender(),
        {
            value: toNano('0.01'),
        },
        null, // empty message, handled by `receive()` without parameters
    );

    // create proposal
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const deployNewProposalResult = await proposalMaster.send(
        masterDeployer.getSender(),
        {
            value: toNano('0.1'),
            bounce: false,
        },
        {
            $$type: 'DeployNewProposal',
            votingEndingAt: currentTime + 24n * 60n * 60n,
        },
    );
    expect(deployNewProposalResult.transactions).toHaveTransaction({
        from: masterDeployer.address,
        to: proposalMaster.address,
        success: true,
    });
    expect(deployNewProposalResult.transactions).toHaveTransaction({
        from: proposalMaster.address,
        success: true,
        deploy: true,
    });

    // vote
    const voter = await blockchain.treasury('voter');
    const proposal = blockchain.openContract(
        await Proposal.fromInit({
            $$type: 'ProposalInit',
            master: proposalMaster.address,
            proposalId: 0n,
        }),
    );
    await proposal.send(
        voter.getSender(),
        { value: toNano('0.1') },
        {
            $$type: 'Vote',
            value: true,
        },
    );

    // the vote was counted
    expect(await proposal.getProposalState()).toMatchObject({ yesCount: 1n, noCount: 0n });
});
