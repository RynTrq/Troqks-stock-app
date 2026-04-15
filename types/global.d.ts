import type {
    Control,
    FieldError,
    FieldValues,
    Path,
    RegisterOptions,
    UseFormRegister
} from "react-hook-form";

declare global {
    type SignInFormData = {
        email: string;
        password: string;
    };

    type SignUpFormData = {
        fullName: string;
        email: string;
        password: string;
        country: string;
        investmentGoals: string;
        riskTolerance: string;
        preferredIndustry: string;
    };

    type CountrySelectProps = {
        name: keyof SignUpFormData;
        label: string;
        control: Control<SignUpFormData>;
        error?: FieldError;
        required?: boolean;
    };

    type FormInputProps<TFormValues extends FieldValues = FieldValues> = {
        name: Path<TFormValues>;
        label: string;
        placeholder: string;
        type?: string;
        register: UseFormRegister<TFormValues>;
        error?: FieldError;
        validation?: RegisterOptions<TFormValues, Path<TFormValues>>;
        disabled?: boolean;
        value?: string;
    };

    type Option = {
        value: string;
        label: string;
    };

    type SelectFieldProps = {
        name: keyof SignUpFormData;
        label: string;
        placeholder: string;
        options: readonly Option[];
        control: Control<SignUpFormData>;
        error?: FieldError;
        required?: boolean;
    };

    type FooterLinkProps = {
        text: string;
        linkText: string;
        href: string;
    };

    type User = {
        id: string;
        name: string;
        email: string;
    };

    type SessionUser = User;
}

export {};
