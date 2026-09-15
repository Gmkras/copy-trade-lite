## Purpose

A self-contained page that answers three common computer-science questions — stack versus heap, what a stack overflow is, and how TCP differs from UDP — by showing where each one already appears in this trading app, with one thing to operate per question.

## ADDED Requirements

### Requirement: The page is reachable only by its address
`/learn` SHALL render a complete page at its URL and SHALL NOT be linked from the navigation bar, the feed or the trade screen. The navigation bar SHALL keep exactly its two tabs on this page, with neither highlighted, because neither is the page being shown. The page SHALL be reachable directly, on a first load, without visiting another screen first.

#### Scenario: Reachable by typing the address
- **WHEN** a visitor opens `/learn` directly
- **THEN** the full page renders, with the navigation bar present and neither Feed nor Trade highlighted

#### Scenario: Nothing links to it
- **WHEN** the feed, the trade screen and the navigation bar are searched for a link to `/learn`
- **THEN** none is found, and both tabs still lead to their own screens

### Requirement: Each question opens with one sentence, then something to operate
The page SHALL present exactly three sections — stack and heap, stack overflow, and TCP versus UDP — in that order. Each section SHALL begin with a single short sentence stating the idea in the app's own terms, SHALL place its interactive above the prose so it is used before anything is read, and SHALL end with a one-line "if you remember nothing else" summary. All text SHALL be in English.

#### Scenario: The three sections in order
- **WHEN** the page renders
- **THEN** the three sections appear in the stated order, each with a one-sentence opening, an interactive, explanation, and a closing one-line summary

#### Scenario: The interactive comes first
- **WHEN** a section renders
- **THEN** its interactive sits above that section's paragraphs of explanation

### Requirement: The stack and heap section is operated, not just read
The stack-and-heap interactive SHALL step through this app's own order path, pushing a frame per call and popping it on return, while showing a heap allocation that outlives the frame that created it. It SHALL let the reader step forward and back, and SHALL name what frees each one — a garbage collector for the browser, scope for Rust.

#### Scenario: Frames push and pop
- **WHEN** the reader steps through the whole sequence
- **THEN** frames appear in call order and disappear in reverse order, and the stack is empty at the end

#### Scenario: The heap outlives the frame
- **WHEN** the frame that allocated the candle array returns
- **THEN** the array is still shown on the heap, labelled with what will free it

#### Scenario: Stepping back
- **WHEN** the reader steps backwards
- **THEN** the previous state is restored exactly, and stepping back from the start changes nothing

### Requirement: The overflow section produces the real error
The overflow interactive SHALL let the reader choose a recursion depth and SHALL report whether that depth fits, using a stated stack size and frame size. When it does not fit, it SHALL show the actual error text of each language — `RangeError: Maximum call stack size exceeded` and `thread 'main' has overflowed its stack`. It SHALL offer the same algorithm written recursively and iteratively, and SHALL show that the iterative form never overflows at any depth the control allows. It SHALL also offer a copy-trade framing of the same failure: an idea whose copy produces another copyable idea.

#### Scenario: A depth that fits
- **WHEN** the reader chooses a small depth
- **THEN** the interactive reports that it fits and shows how much of the stack it uses

#### Scenario: A depth that overflows
- **WHEN** the reader raises the depth past what the stated stack holds
- **THEN** the interactive reports an overflow and shows both languages' real error text

#### Scenario: The iterative form never overflows
- **WHEN** the reader switches to the iterative version at the maximum depth
- **THEN** it is reported as fitting, and the two versions of the code are shown together

#### Scenario: The copy loop
- **WHEN** the reader runs the copy-trade variant
- **THEN** it shows a copy producing a copyable idea until the depth runs out, and states that a real copy-trade platform must refuse the cycle

### Requirement: The protocol section makes head-of-line blocking visible
The TCP-versus-UDP interactive SHALL send a fixed number of price updates down two lanes under a reader-controlled loss rate. The TCP lane SHALL deliver every update in order, stalling to retransmit a lost one; the UDP lane SHALL deliver whatever arrives, dropping the lost ones and never stalling. It SHALL report, for each lane, how many updates arrived and how old the newest one is, and SHALL ask which behaviour is wanted for a price and which for an order.

#### Scenario: No loss
- **WHEN** the loss rate is zero
- **THEN** both lanes deliver every update and neither is older than the other

#### Scenario: With loss
- **WHEN** the loss rate is raised
- **THEN** TCP still delivers every update but its newest is older, UDP delivers fewer but its newest is fresher, and both figures are shown

#### Scenario: The question is asked
- **WHEN** a run finishes
- **THEN** the interactive asks which lane suits a price and which suits an order, and states which one this app uses for each

### Requirement: Both languages are shown side by side, and only TypeScript is built
Each section SHALL show the same idea in TypeScript and in Rust, side by side on a wide screen and as switchable panes on a phone, with the Rust pane labelled as being for comparison. The Rust SHALL exist only as text rendered by the page. No Rust file, toolchain or dependency SHALL be added to the project, and the repository SHALL remain entirely TypeScript.

#### Scenario: Both panes are present
- **WHEN** a code comparison renders on a wide screen
- **THEN** the TypeScript and the Rust appear side by side, each labelled, with the Rust marked as a comparison

#### Scenario: One at a time on a phone
- **WHEN** the same comparison renders at 375 px
- **THEN** one language is shown at a time with a control to switch, and no horizontal scrolling of the page is needed

#### Scenario: The project stays TypeScript
- **WHEN** the repository is searched for source files after this change
- **THEN** no `.rs` file exists, no Rust tooling is configured, the dependency list is unchanged, and the type check still passes

### Requirement: The reader can check what they took away
The page SHALL end with six questions covering the three sections, each answered in one tap and marked right or wrong immediately, with a one-line explanation either way. It SHALL show a running score and allow a retry without reloading the page.

#### Scenario: Answering
- **WHEN** the reader picks an answer
- **THEN** it is marked right or wrong at once, the explanation appears, and the score updates

#### Scenario: Retry
- **WHEN** the reader restarts the quiz
- **THEN** every question is unanswered again, the score is zero, and the page is not reloaded

### Requirement: The page carries the app's appearance and its accessibility rules
The page SHALL use the app's existing colour tokens and fonts, with yellow reserved for the one action that matters on the page and the up and down colours reserved for right and wrong. Every control SHALL be operable by keyboard with a visible focus ring, every interactive SHALL be at least 44 px tall, and all motion SHALL stop when the visitor prefers reduced motion.

#### Scenario: Keyboard only
- **WHEN** the page is operated with the keyboard alone
- **THEN** every control can be reached and used, and the focused one is visibly outlined

#### Scenario: Reduced motion
- **GIVEN** the visitor prefers reduced motion
- **WHEN** an interactive runs
- **THEN** it reaches its end state without animating

#### Scenario: One accent
- **WHEN** the page is inspected
- **THEN** yellow marks only the page's single main action, and green and red are used only for correct and incorrect
