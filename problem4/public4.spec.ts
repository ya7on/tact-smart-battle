import '@ton/test-utils';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Proposal } from '../output/solution4_Proposal';
import { ProposalMaster } from '../output/solution4_ProposalMaster';

it('solution4', async () => {
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
    await proposalMaster.send(
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

describe('solution4', () => {
    let blockchain: Blockchain;
    let proposalMaster: SandboxContract<ProposalMaster>;
    let proposal: SandboxContract<Proposal>;

    let deployer: SandboxContract<TreasuryContract>;
    let voter: SandboxContract<TreasuryContract>;
    
    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // init master contract
        proposalMaster = blockchain.openContract(
            await ProposalMaster.fromInit(),
        );

        // deploy master contract
        const masterDeployer = await blockchain.treasury('deployer');
        const deployMasterResult = await proposalMaster.send(
            masterDeployer.getSender(),
            {
                value: toNano('0.01'),
            },
            null, // empty message, handled by `receive()` without parameters
        );
        // Excess gas
        expect(deployMasterResult.transactions).toHaveTransaction({
            from: masterDeployer.address,
            to: proposalMaster.address,
            success: true,
        });

        proposal = blockchain.openContract(
            await Proposal.fromInit({
                $$type: 'ProposalInit',
                master: proposalMaster.address,
                proposalId: 0n,
            }),
        );
    });

    it('excess gas', async () => {
        const voter = await blockchain.treasury('voter');
        const deployProposalResult = await proposalMaster.send(
            voter.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'DeployNewProposal',
                votingEndingAt: BigInt(Math.floor(Date.now() / 1000)) + 24n * 60n * 60n,
            }
        );
        expect(deployProposalResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposalMaster.address,
            success: true,
        });
        expect(deployProposalResult.transactions).toHaveTransaction({
            from: proposalMaster.address,
            to: proposal.address,
            success: true,
            deploy: true,
        });

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
            success: true,
        });
        expect(voteResult.transactions).toHaveTransaction({
            from: proposal.address,
            to: voter.address,
            success: true,
        });
    });

    it('top up', async () => {
        // init master contract
        const proposalMaster = blockchain.openContract(
            await ProposalMaster.fromInit(),
        );

        // deploy master contract
        const masterDeployer = await blockchain.treasury('deployer');
        const deployMasterResult = await proposalMaster.send(
            masterDeployer.getSender(),
            {
                value: toNano('0.005'),
            },
            null, // empty message, handled by `receive()` without parameters
        );
        // Excess gas
        expect(deployMasterResult.transactions).toHaveTransaction({
            from: masterDeployer.address,
            to: proposalMaster.address,
            success: true,
        });

        const voter = await blockchain.treasury('voter');
        const topUpResult = await proposalMaster.send(
            voter.getSender(),
            {
                value: toNano('0.001'),
            },
            null, 
        );
        expect(topUpResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposalMaster.address,
            success: true,
        });
        expect(topUpResult.transactions).not.toHaveTransaction({
            from: proposalMaster.address,
            to: voter.address,
            success: true,
        });

        const smallTopUpResult = await proposalMaster.send(
            voter.getSender(),
            {
                value: toNano('0.005'),
            },
            null, 
        );
        expect(smallTopUpResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposalMaster.address,
            success: true,
        });
        expect(smallTopUpResult.transactions).toHaveTransaction({
            from: proposalMaster.address,
            to: voter.address,
        });
    });

    it('cannot change mind', async () => {
        const voter = await blockchain.treasury('voter');
        const deployProposalResult = await proposalMaster.send(
            voter.getSender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'DeployNewProposal',
                votingEndingAt: BigInt(Math.floor(Date.now() / 1000)) + 24n * 60n * 60n,
            }
        );

        const successVoteResult = await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );
        expect(successVoteResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposal.address,
            success: true,
        });
        // expect(successVoteResult.transactions).toHaveTransaction({
        //     from: proposal.address,
        //     to: voter.address,
        //     success: true,
        // });
        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 1n, noCount: 0n });

        const errorVoteResult = await proposal.send(
            voter.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'Vote',
                value: true,
            },
        );
        expect(errorVoteResult.transactions).toHaveTransaction({
            from: voter.address,
            to: proposal.address,
            success: false,
        });
        expect(errorVoteResult.transactions).toHaveTransaction({
            from: proposal.address,
            to: voter.address,
            success: true,
        });
        expect(await proposal.getProposalState()).toMatchObject({ yesCount: 1n, noCount: 0n });
    });

    it('2025', async () => {
        // vote
        const voter2 = await blockchain.treasury('voter2');
        const proposal = blockchain.openContract(
            await Proposal.fromInit({
                $$type: 'ProposalInit',
                master: proposalMaster.address,
                proposalId: 1n,
            }),
        );
        const proposalDeployResult = await proposal.send(
            voter2.getSender(),
            { value: toNano('0.1') },
            {
                $$type: 'ProposalStateRequest',
                initiator: voter2.address,
                votingEndingAt: BigInt(Math.floor(Date.now() / 1000)) + 24n * 60n * 60n,
            }
        );
        expect(proposalDeployResult.transactions).toHaveTransaction({
            from: voter2.address,
            to: proposal.address,
            success: false,
            exitCode: 2025,
        });
    });
});

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

// describe('ai helping', () => {
//     let blockchain: Blockchain;
//     let proposalMaster: SandboxContract<ProposalMaster>;
//     let proposal: SandboxContract<Proposal>;

//     let deployer: SandboxContract<TreasuryContract>;
//     let voter: SandboxContract<TreasuryContract>;
    
//     beforeEach(async () => {
//         blockchain = await Blockchain.create();

//         // Initialize ProposalMaster contract
//         proposalMaster = blockchain.openContract(
//             await ProposalMaster.fromInit(),
//         );

//         // Deploy ProposalMaster contract
//         deployer = await blockchain.treasury('deployer');
//         const deployMasterResult = await proposalMaster.send(
//             deployer.getSender(),
//             {
//                 value: toNano('0.01'),
//             },
//             null, // empty message, handled by `receive()` without parameters
//         );
//         expect(deployMasterResult.transactions).toHaveTransaction({
//             from: deployer.address,
//             to: proposalMaster.address,
//             success: true,
//         });

//         // Initialize Proposal contract
//         proposal = blockchain.openContract(
//             await Proposal.fromInit({
//                 $$type: 'ProposalInit',
//                 master: proposalMaster.address,
//                 proposalId: 0n,
//             }),
//         );

//         // Initialize voter
//         voter = await blockchain.treasury('voter');
//     });

//     describe('ai helping', () => {
//         it('should return excess funds to the sender', async () => {
//             const result = await proposalMaster.send(
//                 voter.getSender(),
//                 {
//                     value: toNano('0.2'),
//                 },
//                 null,
//             );
//             expect(result.transactions).toHaveTransaction({
//                 from: voter.address,
//                 to: proposalMaster.address,
//                 success: true,
//             });
//             expect(result.transactions).toHaveTransaction({
//                 from: proposalMaster.address,
//                 to: voter.address,
//                 success: true,
//             });
//         });

//         it('should increment proposalId for each new proposal', async () => {
//             for (let i = 0; i < 3; i++) {
//                 const result = await proposalMaster.send(
//                     deployer.getSender(),
//                     {
//                         value: toNano('0.1'),
//                     },
//                     {
//                         $$type: 'DeployNewProposal',
//                         votingEndingAt: BigInt(Math.floor(Date.now() / 1000)) + 24n * 60n * 60n,
//                     },
//                 );
//                 expect(result.transactions).toHaveTransaction({
//                     from: proposalMaster.address,
//                     success: true,
//                     deploy: true,
//                 });
//                 const proposal = blockchain.openContract(
//                     await Proposal.fromInit({
//                         $$type: 'ProposalInit',
//                         master: proposalMaster.address,
//                         proposalId: BigInt(i),
//                     }),
//                 );
//                 expect(await proposal.getProposalState()).toBeDefined();
//             }
//         });

//         it('should not accept votes after the voting deadline', async () => {
//             const currentTime = Math.floor(Date.now() / 1000);
//             blockchain.now = currentTime;
//             await proposalMaster.send(
//                 deployer.getSender(),
//                 {
//                     value: toNano('0.1'),
//                 },
//                 {
//                     $$type: 'DeployNewProposal',
//                     votingEndingAt: BigInt(currentTime) + 10n, // 10 seconds
//                 },
//             );

//             blockchain.now = (currentTime||0) + 11; // 11 seconds later

//             const proposal = blockchain.openContract(
//                 await Proposal.fromInit({
//                     $$type: 'ProposalInit',
//                     master: proposalMaster.address,
//                     proposalId: 0n,
//                 }),
//             );

//             const result = await proposal.send(
//                 voter.getSender(),
//                 { value: toNano('0.1') },
//                 {
//                     $$type: 'Vote',
//                     value: true,
//                 },
//             );
//             expect(result.transactions).toHaveTransaction({
//                 from: voter.address,
//                 to: proposal.address,
//                 success: false,
//             });
//         });

//         it('should not accept more than 100 votes', async () => {
//             const currentTime = BigInt(Math.floor(Date.now() / 1000));
//             await proposalMaster.send(
//                 deployer.getSender(),
//                 {
//                     value: toNano('0.1'),
//                 },
//                 {
//                     $$type: 'DeployNewProposal',
//                     votingEndingAt: currentTime + 24n * 60n * 60n,
//                 },
//             );

//             const proposal = blockchain.openContract(
//                 await Proposal.fromInit({
//                     $$type: 'ProposalInit',
//                     master: proposalMaster.address,
//                     proposalId: 0n,
//                 }),
//             );

//             for (let i = 0; i < 100; i++) {
//                 const voter = await blockchain.treasury(`voter${i}`);
//                 const result = await proposal.send(
//                     voter.getSender(),
//                     { value: toNano('0.1') },
//                     {
//                         $$type: 'Vote',
//                         value: true,
//                     },
//                 );
//                 expect(result.transactions).toHaveTransaction({
//                     from: voter.address,
//                     to: proposal.address,
//                     success: true,
//                 });
//             }

//             const extraVoter = await blockchain.treasury('extraVoter');
//             const result = await proposal.send(
//                 extraVoter.getSender(),
//                 { value: toNano('0.1') },
//                 {
//                     $$type: 'Vote',
//                     value: true,
//                 },
//             );
//             expect(result.transactions).toHaveTransaction({
//                 from: extraVoter.address,
//                 to: proposal.address,
//                 success: false,
//             });
//         });
//     });
// });
