const NOT_ENOUGH_VALUE: Int = 13371;
const VOTING_ENDED: Int = 13372;
const BAD_VOTE: Int = 13373;
const INVALID_OWNER: Int = 13374;

message VoteInternal {
    success: Bool;
    voter: Address;
    value: Bool;
}

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
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: msg.toCell()
        });
    }

    receive(msg: VoteInternal) {
        send(SendParameters{
            to: msg.voter,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
        });

        let voter = initOf Voter(InitVoter{
            proposal: myAddress(),
            voter: msg.voter
        });
        
        nativeThrowUnless(INVALID_OWNER, contractAddress(voter) == sender());
        nativeThrowUnless(BAD_VOTE, msg.success);

        if (msg.value) {
            self.yesCount += 1;
        } else {
            self.noCount += 1;
        }
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
            send(SendParameters{
                to: self.proposal,
                value: 0,
                mode: SendRemainingValue | SendIgnoreErrors,
                body: VoteInternal{
                    success: false,
                    voter: self.owner,
                    value: msg.value
                }.toCell()
            });
            return;
        }

        send(SendParameters{
            to: self.proposal,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            body: VoteInternal{
                success: true,
                voter: self.owner,
                value: msg.value
            }.toCell()
        });

        self.voted = true;
    }
}
