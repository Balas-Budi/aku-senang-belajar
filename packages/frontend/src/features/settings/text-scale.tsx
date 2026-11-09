import { useLearningSettings, type TextSize } from './queries';

const percent: Record<TextSize, number | null> = {
    normal: null,
    large: 112.5,
    larger: 125,
};

export function TextScale() {
    const size = percent[useLearningSettings().textSize];
    return size ? <style>{`html{font-size:${size}%}`}</style> : null;
}
