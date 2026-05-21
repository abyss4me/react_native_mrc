import { Button } from './Button';
import { Keyboard } from './Keyboard';
import { Container } from './Container';
import { ImageComponent } from './Image';
import { TextComponent } from './Text';
import { Template } from './Template';
import { ComponentMap } from './ComponentRegistry';

ComponentMap.button = Button;
ComponentMap.keyboard = Keyboard;
ComponentMap.container = Container;
ComponentMap.image = ImageComponent;
ComponentMap.text = TextComponent;
ComponentMap.template = Template;

export { ComponentMap, Button, Keyboard, Container, ImageComponent, TextComponent, Template };
