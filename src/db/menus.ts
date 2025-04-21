import { Separator, checkbox, input, select } from "@inquirer/prompts";

const PAGE_SIZE = 20;
const AUTO_ID_KEY = "_autoId_";

type SeparatorType = "---";
type OptionDef = { id?: string; text: string; action?: () => Promise<void> };
type CheckOptionDef = OptionDef & { checked?: boolean; disabled?: boolean };
type CheckOptionsListDef = (CheckOptionDef | SeparatorType)[];
type OptionsListDef = (OptionDef | SeparatorType)[];
type OptionsList = (OptionDef | CheckOptionDef | Separator)[];

const createChoices = (
	options: CheckOptionsListDef | OptionsListDef,
	addTrailingSeparator = true,
) => {
	const processedOptions: OptionsList = options.map((option) =>
		option === "---" ? new Separator() : option,
	);

	if (addTrailingSeparator && options.length > PAGE_SIZE) {
		processedOptions.push(new Separator());
	}

	return processedOptions.map((option, i) =>
		option instanceof Separator
			? option
			: {
					value: option.id ?? `${AUTO_ID_KEY}${i}`,
					checked: "checked" in option ? option.checked : undefined,
					disabled: "disabled" in option ? option.disabled : undefined,
					name: option.text,
				},
	);
};

const findOptions = (optionsList: OptionsListDef, keys: string[]): OptionDef[] => {
	const options = keys.map(
		(key) =>
			optionsList.find(
				(option, i) =>
					option !== "---" &&
					((option as OptionDef).id ? (option as OptionDef).id : AUTO_ID_KEY + i) === key,
			) as OptionDef | undefined,
	);

	if (options.every((option) => option !== undefined)) return options as OptionDef[];
	throw new Error("One or more keys were not found in the options list");
};

export const listPrompt = async (
	message: string,
	options: OptionsListDef,
): Promise<OptionDef> => {
	const choice: string = await select({
		message,
		choices: createChoices(options),
		pageSize: PAGE_SIZE,
	});

	const opts = findOptions(options, [choice]);
	if (opts.length === 0) throw new Error("No options found");
	return opts[0] as OptionDef;
};

export const checkboxesPrompt = async (
	message: string,
	options: CheckOptionsListDef,
): Promise<OptionDef[]> => {
	const choices: string[] = await checkbox({
		message,
		choices: createChoices(options),
		pageSize: PAGE_SIZE,
	});

	return findOptions(options, choices);
};

export const inputPrompt = async (message: string, defaultVal?: string): Promise<string> => {
	return input({ message, default: defaultVal });
};
