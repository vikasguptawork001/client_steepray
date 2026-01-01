import { configureStore } from '@reduxjs/toolkit';
import sellItemReducer from './slices/sellItemSlice';

export const store = configureStore({
  reducer: {
    sellItem: sellItemReducer,
  },
});

// TypeScript types (if using TypeScript)
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;

