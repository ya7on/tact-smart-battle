//
// Public solution template
//

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

struct Config18 {
    data: map<Int, Int>;
    // utime_since: Int as uint32;
    // bit_price_ps: Int as uint64;
    // cell_price_ps: Int as uint64;
}

const ACCOUNT_BITS: Int = 2740;
const ACCOUNT_CELLS: Int = 6;
const BIT_PRICE_PS: Int = 1;
const CELL_PRICE_PS: Int = 500;

const BITS_FEES: Int = ACCOUNT_BITS * BIT_PRICE_PS;
const CELLS_FEES: Int = ACCOUNT_CELLS * CELL_PRICE_PS;
const TOTAL_FEES: Int = BITS_FEES + CELLS_FEES;

contract Proposal {
    yesCount: Int as uint32 = 0;
    noCount: Int as uint32 = 0;
    voters: map<Address, Bool> = emptyMap();
    votersCount: Int as uint32 = 0;

    votingEndingAt: Int as uint32;
    proposalId: Int as uint32;

    minBalance: Int as coins;

    init(data: Init) {
        require(data.votingEndingAt > now(), "Voting period has already ended.");

        self.votingEndingAt = data.votingEndingAt;
        self.proposalId = data.proposalId;

        let remaining = data.votingEndingAt - now();

        self.minBalance = TOTAL_FEES * remaining / 65536;
        require(myBalance() >= self.minBalance, "Insufficient fees for proposal creation.");
    }

    // deploy
    receive() {
        send(SendParameters {
            to: sender(),
            value: myBalance() - self.minBalance,
            mode: SendIgnoreErrors,
        });
    }

    receive(msg: Vote) {
        // Check if the sender has already voted
        require(!self.voters.exists(sender()), "You have already voted.");
        // Check if the voting period has ended
        require(self.votingEndingAt > now(), "Voting period has ended.");
        // Check voters count
        require(self.votersCount < 100, "Voting limit reached.");
        
        // Update the vote count based on the message value
        if msg.value {
            self.yesCount += 1;
        } else {
            self.noCount += 1;
        }
        
        // Mark the sender as having voted
        self.voters.set(sender(), msg.value);
        self.votersCount += 1;

        send(SendParameters {
            to: sender(),
            value: myBalance() - self.minBalance,
            mode: SendIgnoreErrors,
        });
    }

    get fun proposalState(): ProposalState {
        return ProposalState {
            yesCount: self.yesCount,
            noCount: self.noCount
        };
    }
}
