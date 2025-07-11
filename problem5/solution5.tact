const NOT_ENOUGH_VALUE: Int = 13371;
const VOTING_ENDED: Int = 13372;
const BAD_VOTE: Int = 13373;
const INVALID_OWNER: Int = 13374;

message VoteInternal {
    success: Bool;
    value: Bool;
    voter: Address;
}

message(0xd53276db) Excesses {}

message Vote {
    value: Bool;
}

struct ProposalState {
    yesCount: Int as uint32;
    noCount: Int as uint32;
}

struct Init {
    proposalId: Int as uint32;
    votingEndingAt: Int as uint32;
}

struct InitVoter {
    proposal: Address;
    voter: Address;
}

contract Proposal {
    yesCount: Int as uint32 = 0;
    noCount: Int as uint32 = 0;
    votingEndingAt: Int as uint32;
    proposalId: Int as uint32;

    init(data: Init) {
        require(data.votingEndingAt > now(), "Voting period has already ended");
        self.votingEndingAt = data.votingEndingAt;
        self.proposalId = data.proposalId;

        require(myBalance() >= ton("0.01"), "Proposal contract must have a minimum balance");
    }

    receive() {
    }

    get fun test(): Int {
        let deployFee: Int = getForwardFee(4, 183 * 8, false);
        let voteMsgFee: Int = getForwardFee(1, 11 * 8, false);
        let voteInternalFee: Int = getForwardFee(4, 782 * 8, false);
        let requiredFunds: Int = (deployFee + voteMsgFee + voteInternalFee);

        return requiredFunds * 2;
    }

    receive(msg: Vote) {
        let ctx = context();
        require(ctx.value >= ton("0.1"), "Value must be greater than 0");

        let deployFee: Int = getForwardFee(4, 183 * 8, false);
        let voteMsgFee: Int = getForwardFee(1, 11 * 8, false);
        let voteInternalFee: Int = getForwardFee(4, 782 * 8, false);
        let requiredFunds: Int = (deployFee + voteMsgFee + voteInternalFee) * 2;

        nativeThrowUnless(NOT_ENOUGH_VALUE, ctx.value >= requiredFunds);
        nativeThrowUnless(VOTING_ENDED, self.votingEndingAt > now());

        deploy(DeployParameters{
            init: initOf Voter(InitVoter{
                proposal: myAddress(),
                voter: sender()
            }),
            bounce: false,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: msg.toCell()
        });
    }

    receive(msg: VoteInternal) {
        if (msg.success && msg.value) {
            self.yesCount += 1;
        } 
        if (msg.success && !msg.value) {
            self.noCount += 1;
        }

        message(MessageParameters{
            to: msg.voter,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: Excesses{}.toCell(),
        });

        throwUnless(BAD_VOTE, msg.success);
    }

    get fun proposalState(): ProposalState {
        return ProposalState{
            yesCount: self.yesCount,
            noCount: self.noCount
        };
    }
}

contract Voter {
    proposal: Address;
    owner: Address;
    voted: Bool = false;

    init(data: InitVoter) {
        self.proposal = data.proposal;
        self.owner = data.voter;
    }

    receive() {}

    receive(msg: Vote) {
        nativeThrowUnless(INVALID_OWNER, sender() == self.proposal);

        if (self.voted) {
            message(MessageParameters{
                to: self.proposal,
                value: 0,
                mode: SendRemainingBalance | SendIgnoreErrors,
                bounce: false,
                body: VoteInternal{
                    success: false,
                    value: msg.value,
                    voter: self.owner,
                }.toCell()
            });
            return;
        }

        message(MessageParameters{
            to: self.proposal,
            value: 0,
            mode: SendRemainingBalance | SendIgnoreErrors,
            bounce: false,
            body: VoteInternal{
                success: true,
                value: msg.value,
                voter: self.owner,
            }.toCell()
        });

        self.voted = true;
    }
}