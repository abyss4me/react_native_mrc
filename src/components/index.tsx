import { Button } from './Button';
import { Keyboard } from './Keyboard';
import { Container } from './Container';
import { ImageComponent } from './Image';
import { TextComponent } from './Text';
import { Template } from './Template';
import { Touchpad } from './Touchpad';
import { ProgressBar } from './ProgressBar';
import { Joystick } from './Joystick';
import { Dpad } from './Dpad';
import { ComponentMap, ComponentProps } from './ComponentRegistry';
import React from 'react';

type AnyComponent = React.FC<ComponentProps>;

ComponentMap.button = Button as AnyComponent;
ComponentMap.keyboard = Keyboard as AnyComponent;
ComponentMap.container = Container as AnyComponent;
ComponentMap.image = ImageComponent as AnyComponent;
ComponentMap.text = TextComponent as AnyComponent;
ComponentMap.template = Template as AnyComponent;
ComponentMap.touchpad = Touchpad as AnyComponent;
ComponentMap.progressbar = ProgressBar as AnyComponent;
ComponentMap.joystick = Joystick as AnyComponent;
ComponentMap.dpad = Dpad as AnyComponent;

export { ComponentMap, Button, Keyboard, Container, ImageComponent, TextComponent, Template, Touchpad, ProgressBar, Joystick, Dpad };
