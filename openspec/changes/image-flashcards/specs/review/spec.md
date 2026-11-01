# Spec Delta

## Purpose

Lets the learner practice saved cards: see the Chinese text, reveal its meaning and pinyin, hear the pronunciation, and let spaced repetition decide when each card returns.

## ADDED Requirements

### Requirement: Due card selection
The system SHALL present cards for review once their scheduled due time has passed.

#### Scenario: Cards are due
- **WHEN** the learner starts a review and at least one card is due
- **THEN** the system presents one due card

#### Scenario: Nothing is due
- **WHEN** the learner starts a review and no card is due
- **THEN** the system reports that there are no cards to review instead of presenting a card

### Requirement: Prompt before reveal
Before the answer is revealed, the review prompt SHALL show the card's Chinese text without its pinyin or English translation.

#### Scenario: Viewing a new card in review
- **WHEN** a due card is presented
- **THEN** the learner sees the Chinese text only

### Requirement: Reveal answer
The learner SHALL be able to reveal a card's pinyin, English translation, explanation, and example sentence during review.

#### Scenario: Revealing the answer
- **WHEN** the learner reveals the answer for the presented card
- **THEN** the system shows the card's pinyin, English translation, explanation, and example sentence with its pinyin and English translation

### Requirement: Audio playback during review
The learner SHALL be able to play a card's pronunciation audio at any time during review.

#### Scenario: Playing audio
- **WHEN** the learner plays audio for the presented card
- **THEN** the system plays that card's pronunciation audio

#### Scenario: Audio is unavailable
- **WHEN** the presented card has no cached audio
- **THEN** the system indicates that audio is unavailable and does not play anything

### Requirement: Grading and scheduling
After revealing the answer, the learner SHALL be able to grade the card, and the system SHALL record the grade and schedule the card's next due time using spaced repetition.

#### Scenario: Grading a card
- **WHEN** the learner reveals the answer and selects a grade
- **THEN** the system records the grade and sets the card's next due time according to the spaced-repetition schedule

#### Scenario: Returning after grading
- **WHEN** the learner returns to a card that was already graded
- **THEN** its recorded grade and scheduled due time are unchanged

### Requirement: Offline review
The system SHALL let the learner review stored due cards and play cached audio without a network connection.

#### Scenario: Reviewing without connectivity
- **WHEN** the device has no network connection and stored cards are due
- **THEN** the learner can review those cards and play their cached audio

### Requirement: Review session progress
During a review session, the system SHALL show how many due cards remain.

#### Scenario: Progress after grading
- **WHEN** the learner grades a card in a review session
- **THEN** the remaining due-card count decreases by one
