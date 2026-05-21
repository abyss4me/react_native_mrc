// src/components/Template.tsx
import React from 'react';
import { ComponentMap } from './ComponentRegistry';

export const Template = ({ config, templates, ...rest }: any) => {
    if (!templates || !templates[config.templateId]) {
        console.warn(`Template reference "${config.templateId}" not found.`);
        return null;
    }

    const templateConfig = templates[config.templateId];

    // Merge the template's base config with the instance's overrides (like position, anchor, etc.)
    // The final 'type' comes from the template definition itself.
    const resolvedConfig = {
        ...templateConfig,
        ...config,
        type: templateConfig.type
    };

    // Look up the actual component type from the resolved config
    const Component = ComponentMap[resolvedConfig.type as keyof typeof ComponentMap];

    if (!Component) {
        console.warn(`Component type "${resolvedConfig.type}" specified by template "${config.templateId}" is not registered.`);
        return null;
    }

    // Render the actual component, passing down all props, including the crucial 'templates' prop for nesting.
    return <Component config={resolvedConfig} templates={templates} {...rest} />;
};
