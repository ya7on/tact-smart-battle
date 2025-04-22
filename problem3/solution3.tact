//
// Public solution template
//

message Vote {
    value: Bool;
}

message VoteInternal {
    voter: Address;
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

const BIT_PRICE_PS: Int = 1;
const CELL_PRICE_PS: Int = 500;

/// PROPOSAL FEES
const PROPOSAL_ACCOUNT_BITS: Int = 2740;
const PROPOSAL_ACCOUNT_CELLS: Int = 6;
const PROPOSAL_BITS_FEES: Int = PROPOSAL_ACCOUNT_BITS * BIT_PRICE_PS;
const PROPOSAL_CELLS_FEES: Int = PROPOSAL_ACCOUNT_CELLS * CELL_PRICE_PS;
const PROPOSAL_TOTAL_FEES: Int = PROPOSAL_BITS_FEES + PROPOSAL_CELLS_FEES;

/// VOTER FEES
const VOTER_ACCOUNT_BITS: Int = 2740;
const VOTER_ACCOUNT_CELLS: Int = 6;
const VOTER_BITS_FEES: Int = VOTER_ACCOUNT_BITS * BIT_PRICE_PS;
const VOTER_CELLS_FEES: Int = VOTER_ACCOUNT_CELLS * CELL_PRICE_PS;
const VOTER_TOTAL_FEES: Int = VOTER_BITS_FEES + VOTER_CELLS_FEES;

contract Proposal {
    yesCount: Int as uint32 = 0;
    noCount: Int as uint32 = 0;

    votingEndingAt: Int as uint32;
    proposalId: Int as uint32;

    minBalance: Int as coins;

    init(data: Init) {
        require(data.votingEndingAt > now(), "Voting period has already ended.");

        self.votingEndingAt = data.votingEndingAt;
        self.proposalId = data.proposalId;

        let remaining = data.votingEndingAt - now();
        self.minBalance = PROPOSAL_TOTAL_FEES * remaining / 65536;
        require(myBalance() >= self.minBalance, "Insufficient fees for proposal creation.");
    }

    // deploy
    receive() { }

    receive(msg: Vote) {
        // Check if the voting period has ended
        require(self.votingEndingAt > now(), "Voting period has ended.");
        // Check if the sender has enough balance to vote
        require(myBalance() >= self.minBalance, "Insufficient fees for vote.");

        let voter = initOf Voter(InitVoter {
            proposal: myAddress(),
            voter: sender(),
        });
        send(SendParameters {
            to: contractAddress(voter),
            value: 0, // TODO: voter min balance
            body: msg.toCell(),
            data: voter.data,
            code: voter.code,
            mode: SendRemainingValue,
        });

        // TODO: implement
    }

    receive(msg: VoteInternal) {
        let voter = initOf Voter(InitVoter {
            proposal: myAddress(),
            voter: msg.voter,
        });
        require(contractAddress(voter) == sender(), "Invalid voter address.");

        if msg.value {
            self.yesCount += 1;
        } else {
            self.noCount += 1;
        }

        // TODO: implement
    }

    get fun proposalState(): ProposalState {
        return ProposalState {
            yesCount: self.yesCount,
            noCount: self.noCount,
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

        // TODO: fees, validations
    }

    receive() {
        
    }

    receive(msg: Vote) {
        require(!self.voted, "You have already voted.");

        send(SendParameters {
            to: self.proposal,
            value: 0,
            body: VoteInternal {
                voter: self.owner,
                value: msg.value,
            }.toCell(),
            mode: SendRemainingValue,
        });

        self.voted = true;
    }
}
