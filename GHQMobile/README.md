# GHQ Mobile

A React Native port of the GHQ strategy game with local bot gameplay.

## Features

- Complete GHQ game implementation with all unit types
- Local AI opponent with multiple difficulty levels
- Touch-based game board interaction
- Real-time game state updates
- Reserve fleet management
- Turn-based gameplay (up to 4 moves per turn)

## Game Rules

GHQ is a tactical strategy game played on an 8x8 board where players command different military units:

- **HQ**: Command unit that must be protected
- **Infantry**: Basic capturing unit
- **Armored Infantry**: Fast capturing unit (2 mobility)
- **Airborne Infantry**: Can parachute, capturing unit
- **Artillery**: Ranged bombardment (2 range)
- **Armored Artillery**: Fast ranged unit (2 mobility, 2 range)
- **Heavy Artillery**: Long-range bombardment (3 range)

### Objective
Capture the enemy HQ to win the game.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── GameBoard.tsx   # Main game board component
│   ├── SquareComponent.tsx # Individual board squares
│   ├── GameInfo.tsx    # Game state display
│   └── GameControls.tsx # Game control buttons
├── screens/
│   └── GameScreen.tsx  # Main game screen
├── game/
│   ├── engine/         # Game logic
│   │   └── gameEngine.ts
│   └── ai/             # AI implementation
│       └── simpleAI.ts
└── types/
    └── index.ts        # Type definitions
```

## AI Difficulty Levels

- **Easy**: Random move selection
- **Medium**: Greedy evaluation-based moves
- **Hard**: Minimax algorithm with alpha-beta pruning

---

This is a React Native project bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
