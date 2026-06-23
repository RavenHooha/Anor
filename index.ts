// Must be the very first import — react-native-gesture-handler requires this
// side-effect import at the top of the entry file to register its native module.
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Import for its side effect: TaskManager.defineTask must run in global scope
// before the OS can invoke the background task on cold start.
import './src/location/backgroundPresence';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
