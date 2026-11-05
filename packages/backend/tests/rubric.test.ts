import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoModule } from '../src/learning/demo-module.ts';
import { competencyRubric } from '../src/learning/rubric.ts';

const valid = {
    visible: ['Explains the idea in their own words.'],
    developing: ['Gets it right after a hint.'],
    notEnough: ['No answer yet.'],
};

test('a rubric needs indicators for every level, none of them blank', () => {
    assert.equal(competencyRubric.safeParse(valid).success, true);
    assert.equal(
        competencyRubric.safeParse({ ...valid, visible: [] }).success,
        false,
    );
    assert.equal(
        competencyRubric.safeParse({ ...valid, developing: ['   '] }).success,
        false,
    );
    assert.equal(
        competencyRubric.safeParse({
            visible: valid.visible,
            developing: valid.developing,
        }).success,
        false,
    );
});

test('every demo competency has a valid rubric', () => {
    for (const { code, rubric } of demoModule.competencies) {
        assert.equal(competencyRubric.safeParse(rubric).success, true, code);
    }
});
