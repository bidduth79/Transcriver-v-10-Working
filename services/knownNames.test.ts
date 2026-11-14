import { describe, it, expect, beforeEach } from 'vitest';
import { speakerNamesIn, learnNames, learnNamesFromHistory, knownNameList, namesForPrompt, addKnownName, removeKnownName } from './knownNames';

const talk = (...names: string[]) => names.map((name, i) => `[0${i}:00] **${name}:** কথা`).join('\n');

beforeEach(() => localStorage.clear());

describe('known names', () => {
  it('takes the real speaker names of a transcript, once each, never a numbered stand-in, a role or an example name', () => {
    expect(speakerNamesIn(talk('মাসুদ কামাল', 'Speaker 1', 'Host', 'উপস্থাপক', 'মাসুদ কামাল', 'সুরভী তরণী'))).toEqual(['মাসুদ কামাল', 'সুরভী তরণী']);
    // Labels the saved history uses instead of names, and the old instructions' example name models copied
    expect(speakerNamesIn(talk('বক্তা ১', 'স্পিকার ২', 'বর্ণনাকারী', 'বিজ্ঞাপন', 'সাক্ষাৎকার গ্রহণকারী', 'সংবাদ পাঠক', 'বিক্ষোভকারী', 'গান', 'হাসিনা আক্তার'))).toEqual([]);
    expect(speakerNamesIn('একটি অনুচ্ছেদ, কোনো নাম নেই')).toEqual([]);
  });

  it('offers a learned name only after it came up in three transcripts, the most frequent first', () => {
    learnNames(talk('সুরভী তরণী', 'হাবিবুর রহমান হাবিব'));
    learnNames(talk('সুরভী তরণী', 'হাবিবুর রহমান হাবিব'));
    expect(namesForPrompt()).toEqual([]);
    learnNames(talk('সুরভী তরণী'));
    learnNames(talk('সুরভী তরণী', 'হাবিবুর রহমান হাবিব'));
    expect(knownNameList()).toEqual([{ name: 'সুরভী তরণী', count: 4, added: false }, { name: 'হাবিবুর রহমান হাবিব', count: 3, added: false }]);
  });

  it('puts the user\'s own names first, and never offers a removed name again', () => {
    for (let i = 0; i < 3; i++) learnNames(talk('বোর্ডার জেনারেল জিয়াউল হাসান', 'সুরভী তরণী'));
    addKnownName(' ব্রিগেডিয়ার জেনারেল জিয়াউল আহসান ');
    removeKnownName('বোর্ডার জেনারেল জিয়াউল হাসান');
    learnNames(talk('বোর্ডার জেনারেল জিয়াউল হাসান'));
    expect(namesForPrompt()).toEqual(['ব্রিগেডিয়ার জেনারেল জিয়াউল আহসান', 'সুরভী তরণী']);
  });

  it('learns again from the whole history', async () => {
    learnNames(talk('পুরনো নাম'));
    const count = await learnNamesFromHistory(async visit => { for (let i = 0; i < 3; i++) visit(talk('নবনীতা')); });
    expect(count).toBe(1);
    expect(knownNameList().map(n => n.name)).toEqual(['নবনীতা']);
  });
});
