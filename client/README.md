# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.





filters   


        this.bannedKeywords = [
            'xxx', 'adult', 'porn', 'sex', 'nude', 'erotic', 'explicit',
            'nsfw', 'hentai', 'ecchi', '18+', 'adults only', 'mature',
            'violent', 'gore', 'horror', 'terror', 'slasher', 'zombie',
            'xxx', 'x-rated', 'adult film', 'adult movie', 'pornography',
            'hentai', 'yuri', 'yaoi', 'ecchi', 'futanari', 'lolicon',
            'shotacon', 'bdsm', 'fetish', 'bondage', 'rape', 'incest',
            'voyeur', 'swinger', 'orgy', 'milf', 'cougar', 'teen',
            'barely legal', 'schoolgirl', 'nurse', 'teacher', 'stepmom',
            'stepsis', 'stepsister', 'mom', 'sister', 'daughter',
            'family taboo', 'taboo', 'forbidden', 'cheating', 'affair',
            'cuckold', 'cuck', 'hotwife', 'gangbang', 'threesome',
            'foursome', 'orgy', 'swinging', 'group sex', 'public',
            'voyeur', 'exhibitionist', 'creampie', 'cumshot', 'blowjob',
            'handjob', 'footjob', 'titjob', 'deep throat', 'anal',
            'double penetration', 'dp', 'gang bang', 'rough', 'hardcore',
            'softcore', 'pov', 'point of view', 'amateur', 'homemade',
            'webcam', 'camgirl', 'streamate', 'chaturbate', 'onlyfans',
            'fansly', 'patreon', 'premium', 'leaked', 'uncensored',
            'censored', 'japanese uncensored', 'jav uncensored'
        ];

        // Safe content categories (whitelist)
        this.safeCategories = [
            'animation', 'cartoon', 'anime', 'kids', 'family', 'educational',
            'naruto', 'dragon ball', 'pokemon', 'disney', 'pixar', 'ghibli',
            'superhero', 'marvel', 'dc comics', 'adventure', 'fantasy', 'comedy',
            'documentary', 'nature', 'science', 'history', 'classic films',
            'bollywood', 'tollywood', 'malayalam cinema', 'tamil cinema',
            'hindi movies', 'indian cinema', 'hollywood', 'action', 'drama',
            'romance', 'musical', 'biography', 'sports', 'music', 'art',
            'culture', 'travel', 'cooking', 'health', 'fitness', 'yoga',
            'meditation', 'inspirational', 'motivational', 'self-help',
            'children', 'toddler', 'preschool', 'educational', 'learning',
            'school', 'college', 'university', 'ted talks', 'lecture',
            'tutorial', 'how-to', 'diy', 'crafts', 'gardening', 'pets',
            'animals', 'wildlife', 'environment', 'conservation', 'space',
            'astronomy', 'physics', 'chemistry', 'biology', 'mathematics',
            'geography', 'history', 'archaeology', 'anthropology', 'psychology',
            'sociology', 'philosophy', 'religion', 'spirituality', 'mythology',
            'folklore', 'fairytale', 'legend', 'myth', 'fable', 'parable'
        ];

        // Anime whitelist
        this.animeWhitelist = [
            'naruto', 'dragon ball', 'pokemon', 'one piece', 'bleach',
            'attack on titan', 'my hero academia', 'demon slayer',
            'death note', 'fullmetal alchemist', 'cowboy bebop',
            'studio ghibli', 'hayao miyazaki', 'spirited away',
            'my neighbor totoro', 'howl\'s moving castle', 'princess mononoke',
            'sailor moon', 'dragon ball z', 'dragon ball super',
            'pokemon anime', 'detective conan', 'case closed',
            'hunter x hunter', 'fairy tail', 'one punch man',
            'mob psycho', 'jojo\'s bizarre adventure', 'evangelion',
            'satoshi kon', 'makoto shinkai', 'your name', 'weathering with you',
            'studio trigger', 'gainax', 'bones', 'madhouse', 'production i.g',
            'kyoto animation', 'toei animation', 'shonen', 'shoujo', 'seinen',
            'josei', 'kodomo', 'mecha', 'isekai', 'slice of life', 'sports anime'
        ];

        // Malayalam cinema whitelist
        this.malayalamWhitelist = [
            'malayalam', 'malayalam cinema', 'malayalam movie', 'mollywood',
            'mammootty', 'mohanlal', 'dileep', 'suresh gopi', 'jayasurya',
            'prithviraj', 'fahadh faasil', 'nivin pauly', 'dulquer salmaan',
            'manju warrier', 'kavya madhavan', 'shobana', 'urvashi', 'parvathy',
            'lal jose', 'priyadarshan', 'sathyan anthikkad', 'adoor gopalakrishnan',
            'kerala', 'trivandrum', 'kochi', 'kozhikode', 'thrissur', 'kannur',
            'keralam', 'god\'s own country', 'kathakali', 'mohiniyattam', 'theyyam'
        ];