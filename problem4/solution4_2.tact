struct ProposalInit {
    master: Address;
    proposalId: Int as uint32;
}

message DeployNewProposal {
    votingEndingAt: Int as uint32;
}

contract ProposalMaster {
    nextProposalId: Int as uint32 = 0;

    receive() {
        let ctx = context();
        if (myBalance() > ton("0.011")) {
            send(SendParameters {
                to: sender(),
                value: myBalance() - ton("0.011"),
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
            });
        }
    }

    receive(msg: DeployNewProposal) {
        require(msg.votingEndingAt > now(), "Voting period has already ended.");

        let proposalId = self.nextProposalId;
        self.nextProposalId += 1;

        let proposal = initOf Proposal(ProposalInit {
            master: myAddress(),
            proposalId: proposalId,
        });

        let ctx = context();
        send(SendParameters {
            to: contractAddress(proposal),
            value: ctx.readForwardFee() * 10,
            mode: SendPayFwdFeesSeparately,
            code: proposal.code,
            data: proposal.data,
            body: ProposalStateRequest {
                votingEndingAt: msg.votingEndingAt,
                initiator: sender(),
            }.toCell(),
        });

        if (myBalance() > ton("0.01")) {
            send(SendParameters {
                to: sender(),
                value: myBalance() - ton("0.01") - ctx.readForwardFee() * 10,
                mode: SendPayFwdFeesSeparately | SendIgnoreErrors,
            });
        }
    }

    get fun nextProposalId(): Int {
        return self.nextProposalId;
    }
}

// ==============================================================================

message Vote {
    value: Bool;
}

struct ProposalState {
    yesCount: Int as uint32;
    noCount: Int as uint32;
    master: Address;
    proposalId: Int as uint32;
    votingEndingAt: Int as uint32;
}

message ProposalStateRequest {
    votingEndingAt: Int as uint32;
    initiator: Address;
}

contract Proposal {
    yesCount: Int as uint32 = 0;
    noCount: Int as uint32 = 0;
    votingEndingAt: Int as uint32 = 0;
    master: Address;
    proposalId: Int as uint32;
    activated: Bool = false;

    voters: map<Address, Bool> = emptyMap();
    votersCount: Int as uint32 = 0;

    init(data: ProposalInit) {
        nativeThrowUnless(2025, sender() == data.master);
        self.master = data.master;
        self.proposalId = data.proposalId;
    }

    receive(msg: ProposalStateRequest) {
        require(msg.votingEndingAt > now(), "Voting period has already ended.");
        require(!self.activated, "Proposal already activated.");
        nativeThrowUnless(2025, sender() == self.master);

        self.votingEndingAt = msg.votingEndingAt;
        self.activated = true;

        send(SendParameters {
            to: msg.initiator,
            value: 0,
            mode: SendRemainingValue,
        });
    }

    receive(msg: Vote) {
        require(self.activated, "Proposal not activated");
        require(now() < self.votingEndingAt, "Voting ended");
        require(!self.voters.exists(sender()), "You have already voted.");
        require(self.votersCount < 100, "Voting limit reached.");

        if (msg.value) {
            self.yesCount += 1;
        } else {
            self.noCount += 1;
        }

        self.voters.set(sender(), msg.value);
        self.votersCount += 1;

        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
        });
    }

    get fun proposalState(): ProposalState {
        return ProposalState{
            yesCount: self.yesCount,
            noCount: self.noCount,
            master: self.master,
            proposalId: self.proposalId,
            votingEndingAt: self.votingEndingAt
        };
    }
}
