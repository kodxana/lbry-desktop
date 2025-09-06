// @flow
import { EMOTES_48px as EMOTES } from 'constants/emotes';
import { matchSorter } from 'match-sorter';
import { SEARCH_OPTIONS } from 'constants/search';
import * as KEYCODES from 'constants/keycodes';
import BusyIndicator from 'component/common/busy-indicator';
import EMOJIS from 'emoji-dictionary';
import LbcSymbol from 'component/common/lbc-symbol';
import Popper from '@mui/material/Popper';
import React from 'react';
import TextareaSuggestionsItem from 'component/textareaSuggestionsItem';
import useLighthouse from 'effects/use-lighthouse';
import useThrottle from 'effects/use-throttle';

const SUGGESTION_REGEX = new RegExp(
  '(?<Mention>(?:^| |\n)@[^\\s=&#$@%?:;/\\"<>%{}|^~[]*(?::[\\w]+)?)|(?<Emote>(?:^| |\n):[\\w+-]*:?)',
  'gm'
);

/** Regex Explained step-by-step:
 *
 * 1) (?<Name>....) = naming a match into a possible group (either Mention or Emote)
 * 2) (?:^| |\n) = only allow for: sentence beginning, space or newline before the match (no words or symbols)
 * 3) [^\s=&#$@%?:;/\\"<>%{}|^~[]* = anything, except the characters inside
 * 4) (?::[\w]+)? = A mention can be matched with a ':' as a claim modifier with words or digits after as ID digits,
 * or else it's everything before the ':' (will then match the winning uri for the mention behind since has no canonical ID)
 * 5) :\w*:? = the emote Regex, possible to be matched with a ':' at the end to consider previously typed emotes
 *
 */

const SEARCH_SIZE = 10;
const LIGHTHOUSE_MIN_CHARACTERS = 3;
const INPUT_DEBOUNCE_MS = 1000;

const EMOJI_MIN_CHARACTERS = 2;

type Props = {
  canonicalCommentors?: Array<string>,
  canonicalCreatorUri?: string,
  canonicalSearch?: Array<string>,
  canonicalSubscriptions?: Array<string>,
  canonicalTop?: string,
  className?: string,
  commentorUris?: Array<string>,
  disabled?: boolean,
  hasNewResolvedResults?: boolean,
  id: string,
  inputRef: any,
  isLivestream?: boolean,
  maxLength?: number,
  placeholder?: string,
  searchQuery?: string,
  showMature: boolean,
  type?: string,
  uri?: string,
  value: any,
  doResolveUris: (Array<string>) => void,
  doSetMentionSearchResults: (string, Array<string>) => void,
  onBlur: (any) => any,
  onChange: (any) => any,
  onFocus: (any) => any,
};

export default function TextareaWithSuggestions(props: Props) {
  const {
    canonicalCommentors,
    canonicalCreatorUri,
    canonicalSearch,
    canonicalSubscriptions: canonicalSubs,
    canonicalTop,
    className,
    commentorUris,
    disabled,
    hasNewResolvedResults,
    id,
    inputRef,
    isLivestream,
    maxLength,
    placeholder,
    searchQuery,
    showMature,
    type,
    value: messageValue,
    doResolveUris,
    doSetMentionSearchResults,
    onBlur,
    onChange,
    onFocus,
  } = props;

  const inputDefaultProps = { className, placeholder, maxLength, type, disabled };

  const [suggestionValue, setSuggestionValue] = React.useState(undefined);
  const [highlightedSuggestion, setHighlightedSuggestion] = React.useState('');
  const [shouldClose, setClose] = React.useState();
  const [debouncedTerm, setDebouncedTerm] = React.useState('');
  // const [mostSupported, setMostSupported] = React.useState('');

  const suggestionTerm = suggestionValue && suggestionValue.term;
  const isEmote = suggestionValue && suggestionValue.isEmote;
  const isMention = suggestionValue && !suggestionValue.isEmote;
  const invalidTerm = suggestionTerm && isMention && suggestionTerm.charAt(1) === ':';

  const additionalOptions = { isBackgroundSearch: false, [SEARCH_OPTIONS.CLAIM_TYPE]: SEARCH_OPTIONS.INCLUDE_CHANNELS };
  const { results, loading } = useLighthouse(debouncedTerm, showMature, SEARCH_SIZE, additionalOptions, 0);
  const stringifiedResults = JSON.stringify(results);

  const hasMinLength = suggestionTerm && isMention && suggestionTerm.length >= LIGHTHOUSE_MIN_CHARACTERS;
  const isTyping = isMention && debouncedTerm !== suggestionTerm;
  const showPlaceholder =
    isMention && !invalidTerm && (isTyping || loading || (results && results.length > 0 && !hasNewResolvedResults));

  const shouldFilter = (uri, previous) => uri !== canonicalCreatorUri && (!previous || !previous.includes(uri));
  const filteredCommentors = canonicalCommentors && canonicalCommentors.filter((uri) => shouldFilter(uri));
  const filteredSubs = canonicalSubs && canonicalSubs.filter((uri) => shouldFilter(uri, filteredCommentors));
  const filteredTop =
    canonicalTop &&
    shouldFilter(canonicalTop, filteredSubs) &&
    shouldFilter(canonicalTop, filteredCommentors) &&
    canonicalTop;
  const filteredSearch =
    canonicalSearch &&
    canonicalSearch.filter(
      (uri) => shouldFilter(uri, filteredSubs) && shouldFilter(uri, filteredCommentors) && uri !== filteredTop
    );

  let emoteNames;
  let emojiNames;
  const allOptions = [];
  if (isEmote) {
    emoteNames = EMOTES.map(({ name }) => name.toLowerCase());
    const hasMinEmojiLength = suggestionTerm && suggestionTerm.length > EMOJI_MIN_CHARACTERS;
    // Filter because our emotes are priority from default emojis, like :eggplant:
    emojiNames = hasMinEmojiLength ? EMOJIS.names.filter((name) => !emoteNames.includes(`:${name}:`)) : [];
    const emotesAndEmojis = [...emoteNames, ...emojiNames];

    allOptions.push(...emotesAndEmojis);
  } else {
    if (canonicalCreatorUri) allOptions.push(canonicalCreatorUri);
    if (filteredSubs) allOptions.push(...filteredSubs);
    if (filteredCommentors) allOptions.push(...filteredCommentors);
    if (filteredTop) allOptions.push(filteredTop);
    if (filteredSearch) allOptions.push(...filteredSearch);
  }

  const allOptionsGrouped =
    allOptions.length > 0
      ? allOptions.map((option) => {
          const groupName = isEmote
            ? (emoteNames.includes(option) && __('Emotes')) || (emojiNames.includes(option) && __('Emojis'))
            : (canonicalCreatorUri === option && __('Creator')) ||
              (filteredSubs && filteredSubs.includes(option) && __('Following')) ||
              (filteredCommentors && filteredCommentors.includes(option) && __('From Comments')) ||
              (filteredTop && filteredTop === option && 'Top') ||
              (filteredSearch && filteredSearch.includes(option) && __('From Search'));

          let emoteLabel;
          if (isEmote) {
            // $FlowFixMe
            emoteLabel = `:${option.replaceAll(':', '')}:`;
          }

          return {
            label: emoteLabel || option.replace('lbry://', '').replace('#', ':'),
            group: groupName,
          };
        })
      : [];

  const allMatches =
    useSuggestionMatch(
      suggestionTerm || '',
      allOptionsGrouped.map(({ label }) => label)
    ) || [];

  /** --------- **/
  /** Functions **/
  /** --------- **/

  function handleInputChange(value: string) {
    onChange({ target: { value } });

    const cursorIndex = inputRef && inputRef.current && inputRef.current.selectionStart;

    const suggestionMatches = value.match(SUGGESTION_REGEX);

    if (!suggestionMatches) {
      if (suggestionValue) setSuggestionValue(null);
      return; // Exit here and avoid unnecessary behavior
    }

    const exec = SUGGESTION_REGEX.exec(value);
    const groups = exec && exec.groups;
    const groupValue = groups && Object.keys(groups).find((group) => groups[group]);

    const previousLastIndexes = [];
    let isEmote = groupValue && groupValue === 'Emote';
    let currentSuggestionIndex = exec && exec.index;
    let currentLastIndex = exec && SUGGESTION_REGEX.lastIndex;
    let currentSuggestionValue =
      cursorIndex >= currentSuggestionIndex &&
      cursorIndex <= currentLastIndex &&
      suggestionMatches &&
      suggestionMatches[0];

    if (suggestionMatches && suggestionMatches.length > 1) {
      currentSuggestionValue = suggestionMatches.find((match, index) => {
        const previousLastIndex = previousLastIndexes[index - 1] || 0;
        const valueWithoutPrevious = value.substring(previousLastIndex);

        const tempRe = new RegExp(SUGGESTION_REGEX);
        const tempExec = tempRe.exec(valueWithoutPrevious);
        const groups = tempExec && tempExec.groups;
        const groupValue = groups && Object.keys(groups).find((group) => groups[group]);

        if (tempExec) {
          isEmote = groupValue && groupValue === 'Emote';
          currentSuggestionIndex = previousLastIndex + tempExec.index;
          currentLastIndex = previousLastIndex + tempRe.lastIndex;
          previousLastIndexes.push(currentLastIndex);
        }

        // the current mention term will be the one on the text cursor's range,
        // in case of there being more in the same comment message
        if (previousLastIndexes) {
          return cursorIndex >= currentSuggestionIndex && cursorIndex <= currentLastIndex;
        }
      });
    }

    if (currentSuggestionValue) {
      const token = isEmote ? ':' : '@';
      const tokenIndex = currentSuggestionValue.indexOf(token);

      // $FlowFixMe
      setSuggestionValue({
        beforeTerm: currentSuggestionValue.substring(0, tokenIndex), // in case of a space or newline
        term: currentSuggestionValue.substring(tokenIndex),
        index: currentSuggestionIndex,
        lastIndex: currentLastIndex,
        isEmote,
      });
    } else if (suggestionValue) {
      setSuggestionValue(null);
    }
  }

  const handleSelect = React.useCallback(
    (selectedValue: string) => {
      if (!suggestionValue) return;

      const elem = inputRef && inputRef.current;
      const newCursorPos = suggestionValue.beforeTerm.length + suggestionValue.index + selectedValue.length + 1;

      const contentBegin = messageValue.substring(0, suggestionValue.index);
      const replaceValue = suggestionValue.beforeTerm + selectedValue;
      const contentEnd =
        messageValue.length > suggestionValue.lastIndex
          ? messageValue.substring(suggestionValue.lastIndex, messageValue.length)
          : ' ';

      const newValue = contentBegin + replaceValue + contentEnd;

      onChange({ target: { value: newValue } });
      setSuggestionValue(null);
      elem.focus();
      elem.setSelectionRange(newCursorPos, newCursorPos);
    },
    [messageValue, inputRef, onChange, suggestionValue]
  );

  /** ------- **/
  /** Effects **/
  /** ------- **/

  React.useEffect(() => {
    if (!isMention) return;

    if (isTyping && suggestionTerm && !invalidTerm) {
      const timer = setTimeout(() => {
        setDebouncedTerm(!hasMinLength ? '' : suggestionTerm);
      }, INPUT_DEBOUNCE_MS);

      return () => clearTimeout(timer);
    }
  }, [hasMinLength, invalidTerm, isMention, isTyping, suggestionTerm]);

  React.useEffect(() => {
    if (!stringifiedResults) return;

    const arrayResults = JSON.parse(stringifiedResults);
    if (debouncedTerm && arrayResults && arrayResults.length > 0) {
      doResolveUris([debouncedTerm, ...arrayResults]);
      doSetMentionSearchResults(debouncedTerm, arrayResults);
    }
  }, [debouncedTerm, doResolveUris, doSetMentionSearchResults, stringifiedResults, suggestionTerm]);

  // Disable sending on Enter on Livestream chat
  React.useEffect(() => {
    if (!isLivestream) return;

    if (suggestionTerm && inputRef) {
      inputRef.current.setAttribute('term', suggestionTerm);
    } else {
      inputRef.current.removeAttribute('term');
    }
  }, [inputRef, isLivestream, suggestionTerm]);

  // Only resolve commentors on Livestreams when first trying to mention/looking for it
  React.useEffect(() => {
    if (isLivestream && commentorUris && suggestionTerm) doResolveUris(commentorUris);
  }, [commentorUris, doResolveUris, isLivestream, suggestionTerm]);

  // Allow selecting with TAB key
  React.useEffect(() => {
    if (!suggestionTerm) return; // only if there is a term, or else can't tab to navigate page

    function handleKeyDown(e: SyntheticKeyboardEvent<*>) {
      const { keyCode } = e;

      if (highlightedSuggestion && keyCode === KEYCODES.TAB) {
        e.preventDefault();
        handleSelect(highlightedSuggestion.label);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelect, highlightedSuggestion, suggestionTerm]);

  /** ------ **/
  /** Render **/
  /** ------ **/

  const renderGroup = (groupName: string, children: any) => (
    <div key={groupName} className="textareaSuggestions__group">
      <label className="textareaSuggestions__label">
        {groupName === 'Top' ? (
          <LbcSymbol prefix={__('Winning Search for %matching_term%', { matching_term: searchQuery })} />
        ) : suggestionTerm && suggestionTerm.length > 1 ? (
          __('%group_name% matching %matching_term%', { group_name: groupName, matching_term: suggestionTerm })
        ) : (
          groupName
        )}
      </label>
      {children}
      <hr className="textareaSuggestions__topSeparator" />
    </div>
  );

  const renderOption = (optionProps: any, label: string) => {
    const emoteFound = isEmote && EMOTES.find(({ name }) => name.toLowerCase() === label);
    const emoteValue = emoteFound ? { name: label, url: emoteFound.url } : undefined;
    const emojiFound = isEmote && EMOJIS.getUnicode(label);
    const emojiValue = emojiFound ? { name: label, unicode: emojiFound } : undefined;

    return <TextareaSuggestionsItem key={label} uri={label} emote={emoteValue || emojiValue} {...optionProps} />;
  };

  // Custom, textarea-anchored suggestion popper to avoid MUI Autocomplete's input requirement.
  const [highlightIndex, setHighlightIndex] = React.useState(0);
  const filteredOptions = React.useMemo(() => {
    return allOptionsGrouped.filter(({ label }) => allMatches.includes(label));
  }, [allMatches, allOptionsGrouped]);

  React.useEffect(() => {
    // reset highlight when list changes or popup reopens
    if (!!suggestionTerm && !shouldClose) {
      setHighlightIndex(0);
      setHighlightedSuggestion(filteredOptions[0]);
    }
  }, [filteredOptions, shouldClose, suggestionTerm]);

  function handleKeyDown(e: SyntheticKeyboardEvent<*>) {
    if (!suggestionTerm || shouldClose) return;
    if (!filteredOptions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (highlightIndex + 1) % filteredOptions.length;
      setHighlightIndex(next);
      setHighlightedSuggestion(filteredOptions[next]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (highlightIndex - 1 + filteredOptions.length) % filteredOptions.length;
      setHighlightIndex(prev);
      setHighlightedSuggestion(filteredOptions[prev]);
    } else if (e.key === 'Enter') {
      if (highlightedSuggestion) {
        e.preventDefault();
        handleSelect(highlightedSuggestion.label);
      }
    } else if (e.key === 'Escape') {
      setClose(true);
    }
  }

  const open = !!suggestionTerm && !shouldClose;

  return (
    <>
      <textarea
        id={id}
        ref={inputRef}
        {...inputDefaultProps}
        value={messageValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => onFocus && onFocus()}
        onBlur={() => onBlur && onBlur()}
        onKeyDown={handleKeyDown}
      />
      <Popper open={open} anchorEl={inputRef && inputRef.current} placement="top">
        <div className="MuiPaper-root">
          {filteredOptions.length === 0 ? (
            <div className="card">
              {showPlaceholder ? <BusyIndicator message={__('Searching...')} /> : __('Nothing found')}
            </div>
          ) : (
            <div className="card">
              {/* Render grouped options */}
              {(() => {
                const groups = [];
                let currentGroup = null;
                let items = [];
                filteredOptions.forEach((opt, idx) => {
                  if (opt.group !== currentGroup) {
                    if (items.length) {
                      groups.push(renderGroup(currentGroup || '', items));
                      items = [];
                    }
                    currentGroup = opt.group;
                  }
                  const isFocused = idx === highlightIndex;
                  const optionProps = {
                    className: `MuiAutocomplete-option${isFocused ? ' Mui-focused' : ''}`,
                    role: 'option',
                    'aria-selected': isFocused,
                    onMouseEnter: () => {
                      setHighlightIndex(idx);
                      setHighlightedSuggestion(opt);
                    },
                    onMouseDown: (e) => {
                      // prevent textarea blur
                      e.preventDefault();
                      handleSelect(opt.label);
                    },
                  };
                  items.push(renderOption(optionProps, opt.label));
                });
                if (items.length) groups.push(renderGroup(currentGroup || '', items));
                return groups;
              })()}
            </div>
          )}
        </div>
      </Popper>
    </>
  );
}

function AutocompletePopper(props: any) {
  return <Popper {...props} placement="top" />;
}

function useSuggestionMatch(term: string, list: Array<string>) {
  const throttledTerm = useThrottle(term);

  return React.useMemo(() => {
    return !throttledTerm || throttledTerm.trim() === ''
      ? undefined
      : matchSorter(list, term, { keys: [(item) => item] });
  }, [list, term, throttledTerm]);
}
