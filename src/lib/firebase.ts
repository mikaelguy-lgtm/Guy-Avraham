import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {requireFrontendConfig} from '../config/frontend';

const config = requireFrontendConfig();
const app = initializeApp(config.firebase);
export const auth = getAuth(app);
if (import.meta.env.DEV && config.useFirebaseEmulator && config.firebaseAuthEmulatorUrl) {
  connectAuthEmulator(auth, config.firebaseAuthEmulatorUrl, {disableWarnings: true});
}
