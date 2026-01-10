import { configureStore } from '@reduxjs/toolkit';
import sellItemReducer from './slices/sellItemSlice';
import sellItem2Reducer from './slices/sellItem2Slice';

export const store = configureStore({
  reducer: {
    sellItem: sellItemReducer,
    sellItem2: sellItem2Reducer,
  },
});

// TypeScript types (if using TypeScript)
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;

