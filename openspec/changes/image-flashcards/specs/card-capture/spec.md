# Spec Delta

## Purpose

Turns a screenshot of Chinese text into a confirmed, pronounceable flashcard, keeping the learner's card data on their own device.

## ADDED Requirements

### Requirement: Image intake
The system SHALL accept an image selected from the device photo library or captured with the device camera, and MUST reject files that are not a supported image format.

#### Scenario: Supported image selected
- **WHEN** the learner selects or captures a supported image file
- **THEN** the system begins extraction on that image

#### Scenario: Unsupported file selected
- **WHEN** the learner selects a file that is not a supported image format
- **THEN** the system reports that the file is not a supported image and does not begin extraction

### Requirement: One card per image
The system SHALL treat each submitted image as the source of exactly one card.

#### Scenario: Image contains several lines
- **WHEN** a submitted image contains multiple lines of Chinese text
- **THEN** the system produces one draft containing the extracted text as a single card

### Requirement: Local extraction and explanation
For a submitted image, the system SHALL extract the Chinese text by processing the image locally on the learner's device or on the learner's own server, and MUST NOT send the image to any third-party provider. From the extracted text, the system SHALL produce a draft containing the Chinese text, its pinyin, an English translation, a short explanation, a new simple example sentence with its pinyin and English translation, and a pronunciation-safe reading of the text.

#### Scenario: Screenshot with Chinese text
- **WHEN** the learner submits an image containing Chinese text
- **THEN** the system shows a draft containing the Chinese text, pinyin, English translation, explanation, example sentence with its pinyin and English translation, and pronunciation-safe reading

#### Scenario: Image with no Chinese text
- **WHEN** the learner submits an image that contains no Chinese text
- **THEN** the system reports that no Chinese text was found and does not create a card

#### Scenario: Extraction fails
- **WHEN** extraction cannot complete because of an OCR, provider, or network failure
- **THEN** the system reports the failure, keeps the image available for another attempt, and does not create a card

### Requirement: Screenshot privacy
The system MUST NOT transmit the source screenshot to any third-party AI or OCR provider. Image processing SHALL happen on the learner's device or on the learner's own server, and only the extracted Chinese text MAY be sent to an AI provider.

#### Scenario: Submitting an image
- **WHEN** the learner submits an image for extraction
- **THEN** the image is processed locally and is not transmitted to any third-party provider, and only the extracted Chinese text is sent for translation, explanation, and example generation

### Requirement: Draft confirmation and editing
The system SHALL present the extracted draft for review, allow the learner to edit every text field, and MUST NOT save a card until the learner confirms the draft.

#### Scenario: Learner edits the draft
- **WHEN** the learner changes the Chinese text, pinyin, translation, explanation, example, or reading in the draft and confirms
- **THEN** the saved card contains the edited values

#### Scenario: Learner discards the draft
- **WHEN** the learner discards a draft instead of confirming it
- **THEN** no card is saved and the pending draft is cleared

### Requirement: Pronunciation audio generation
On confirmation, the system SHALL generate Mandarin pronunciation audio from the card's pronunciation-safe reading and cache that audio with the card.

#### Scenario: Audio generated successfully
- **WHEN** the learner confirms a draft and audio generation succeeds
- **THEN** the card has pronunciation audio cached on the device

#### Scenario: Audio generation fails
- **WHEN** the learner confirms a draft but audio generation fails
- **THEN** the card is saved, is marked as missing audio, and can have audio generated later

### Requirement: Audio regeneration
The learner SHALL be able to regenerate the pronunciation audio for a saved card.

#### Scenario: Regenerating audio
- **WHEN** the learner requests new audio for a saved card
- **THEN** the system generates replacement audio from the card's current pronunciation-safe reading and caches it

### Requirement: On-device card storage
The system SHALL store confirmed cards, including their text fields, audio, and review state, on the device, and MUST make them available after the app is reopened.

#### Scenario: Cards survive reopening
- **WHEN** the learner reopens the app after saving cards
- **THEN** the saved cards are available with their text, audio, and review state intact

#### Scenario: No account required
- **WHEN** the learner uses the app for the first time
- **THEN** the learner can capture and save cards without creating an account or signing in

### Requirement: Provider credential protection
AI provider credentials MUST NOT be exposed to the client device, and all provider calls SHALL be made through the application's server.

#### Scenario: Client requests extraction
- **WHEN** the client requests extraction or audio
- **THEN** the request and response contain no provider credentials, and the provider is called from the server

### Requirement: Card export
The learner SHALL be able to export all stored cards to a portable file that includes each card's text fields and review state.

#### Scenario: Exporting the library
- **WHEN** the learner requests an export
- **THEN** the system downloads a file containing all stored cards with their text fields and review state
