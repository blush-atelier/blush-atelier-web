import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch } from '../application/store';
import type { AppState } from '../application/state';
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<AppState>();
